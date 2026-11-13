const crypto = require("crypto");
const Razorpay = require("razorpay");
const { pool } = require("../repositories/payment.repository");
const notificationRepository =
    require("../repositories/notification.repository");

function getRazorpay() {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
        const error = new Error(
            "Razorpay test credentials are not configured on the backend"
        );
        error.statusCode = 503;
        throw error;
    }

    return {
        client: new Razorpay({ key_id, key_secret }),
        key_id,
        key_secret
    };
}

function makeNumber(prefix) {
    return `${prefix}-${Date.now()}-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;
}

function safeEqualHex(actual, expected) {
    if (typeof actual !== "string" || typeof expected !== "string") {
        return false;
    }

    const a = Buffer.from(actual, "hex");
    const b = Buffer.from(expected, "hex");

    return (
        a.length === b.length &&
        a.length > 0 &&
        crypto.timingSafeEqual(a, b)
    );
}

// ==================================================
// CREATE RAZORPAY ORDER
// POST /api/student/payments/create-order
// ==================================================

async function createOrder(req, res, next) {
    const courseId = Number(
        req.body?.course_id ?? req.body?.courseId
    );

    if (!Number.isSafeInteger(courseId) || courseId <= 0) {
        return res.status(400).json({
            success: false,
            message: "A valid course_id is required"
        });
    }

    let razorpay;

    try {
        razorpay = getRazorpay();
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query("BEGIN");

        // 1. Find the logged-in student's active profile
        const studentResult = await client.query(
            `SELECT id, user_id, institution_id, register_number, student_code
             FROM learning.student
             WHERE user_id = $1
               AND soft_delete = FALSE
               AND is_active = TRUE
             LIMIT 1`,
            [req.user.id]
        );

        if (!studentResult.rowCount) {
            await client.query("ROLLBACK");

            return res.status(403).json({
                success: false,
                message:
                    "An active student profile is required to purchase a course"
            });
        }

        const student = studentResult.rows[0];
        const studentId = student.id;

        // 2. Fetch the published course and its database price
        const courseResult = await client.query(
            `SELECT
                id,
                course_code,
                title,
                price,
                currency_code,
                course_type,
                max_students
             FROM learning.course
             WHERE id = $1
               AND soft_delete = FALSE
               AND is_active = TRUE
               AND status = 'PUBLISHED'
             FOR UPDATE`,
            [courseId]
        );

        if (!courseResult.rowCount) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Published course not found"
            });
        }

        const course = courseResult.rows[0];
        const price = Number(course.price);

        if (!Number.isFinite(price) || price <= 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "This course does not have a valid paid-course price"
            });
        }

        if (course.course_type === "FREE") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "This course is free. Use the normal enrollment endpoint."
            });
        }

        const currency = String(
            course.currency_code || "INR"
        ).toUpperCase();

        // 3. Prevent duplicate enrollment
        const alreadyEnrolled = await client.query(
            `SELECT id, status
             FROM learning.enrollment
             WHERE student_id = $1
               AND course_id = $2
               AND soft_delete = FALSE
               AND status IN ('ACTIVE', 'COMPLETED')
             LIMIT 1`,
            [studentId, courseId]
        );

        if (alreadyEnrolled.rowCount) {
            await client.query("COMMIT");

            return res.status(200).json({
                success: true,
                already_enrolled: true,
                message: "You are already enrolled in this course",
                data: {
                    enrollment_id: alreadyEnrolled.rows[0].id,
                    status: alreadyEnrolled.rows[0].status
                }
            });
        }

        // 4. Check course capacity when a limit is configured
        if (course.max_students) {
            const capacity = await client.query(
                `SELECT COUNT(*)::int AS enrolled_count
                 FROM learning.enrollment
                 WHERE course_id = $1
                   AND soft_delete = FALSE
                   AND status IN ('ACTIVE', 'COMPLETED')`,
                [courseId]
            );

            if (
                capacity.rows[0].enrolled_count >=
                course.max_students
            ) {
                await client.query("ROLLBACK");

                return res.status(409).json({
                    success: false,
                    message:
                        "This course has reached its enrollment limit"
                });
            }
        }

        // Calculate the coupon and instructor referral independently, then cap
        // their combined discount at the course price.
        const requestedCouponCode = req.body?.coupon_code ?? req.body?.code;
        const requestedReferralCode = req.body?.referral_code ?? req.body?.referralCode;
        const couponQuote = requestedCouponCode && String(requestedCouponCode).trim()
            ? await getCouponQuote(client, { code: requestedCouponCode, student, course, price, lockCoupon: true })
            : await getAutomaticCouponQuote(client, {
                student, course, price, lockCoupon: true
            });
        const referralQuote = requestedReferralCode && String(requestedReferralCode).trim()
            ? await getReferralQuote(client, { code: requestedReferralCode, student, course, price })
            : await getStoredStudentReferralQuote(client, { student, course, price });
        const pricingQuote = combineDiscountQuotes({ price, couponQuote, referralQuote });
        const checkout = await reserveCheckoutPricing(client, {
            student, course, couponQuote, referralQuote, pricingQuote, userId: req.user.id
        });
        const enrollmentId = checkout.enrollment_id;
        const paymentId = checkout.payment_id;
        const originalAmount = pricingQuote.original_amount;
        const discountAmount = pricingQuote.discount_amount;
        const finalAmount = pricingQuote.final_amount;
        const couponCode = pricingQuote.coupon_code;
        const amountPaise = Math.round(finalAmount * 100);
        if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
            throw couponError("Payment amount must be greater than zero.");
        }

        await client.query(
            `UPDATE payment.payment
             SET original_amount = $1,
                 discount_amount = $2,
                 referral_discount_amount = $3,
                 coupon_discount_amount = $4,
                 referral_incentive_amount = $5,
                 tax_amount = 0,
                 final_amount = $6,
                 paid_amount = 0,
                 currency_code = $7,
                 status = 'PENDING',
                 payment_gateway = 'RAZORPAY',
                 payment_method = NULL,
                 gateway_order_id = NULL,
                 payment_due_at = NULL,
                 paid_at = NULL,
                 failed_at = NULL,
                 failure_reason = NULL,
                 cancelled_at = NULL,
                 cancellation_reason = NULL,
                 updated_at = NOW(),
                 updated_by = $8
             WHERE id = $9`,
            [
                originalAmount.toFixed(2),
                discountAmount.toFixed(2),
                pricingQuote.referral_discount_amount.toFixed(2),
                pricingQuote.coupon_discount_amount.toFixed(2),
                pricingQuote.referral_incentive_amount.toFixed(2),
                finalAmount.toFixed(2),
                currency,
                req.user.id,
                paymentId
            ]
        );

        // 7. Create Razorpay order using the verified server-side amount
        const order = await razorpay.client.orders.create({
            amount: amountPaise,
            currency,
            receipt: `PAY${paymentId}`,
            notes: {
                payment_id: String(paymentId),
                enrollment_id: String(enrollmentId),
                course_id: String(courseId)
            }
        });

        // 8. Save the Razorpay order ID
        await client.query(
            `UPDATE payment.payment
             SET gateway_order_id = $1,
                 payment_due_at = NOW() + INTERVAL '30 minutes',
                 updated_at = NOW(),
                 updated_by = $3
             WHERE id = $2`,
            [order.id, paymentId, req.user.id]
        );

        // 9. Create the payment transaction record
        await client.query(
            `INSERT INTO payment.payment_transaction
                (
                    payment_id,
                    transaction_number,
                    gateway_order_id,
                    payment_gateway,
                    transaction_type,
                    amount,
                    currency_code,
                    status,
                    created_by
                )
             VALUES
                ($1, $2, $3, 'RAZORPAY', 'PAYMENT', $4, $5,
                 'INITIATED', $6)`,
            [
                paymentId,
                makeNumber("PTXN"),
                order.id,
                finalAmount.toFixed(2),
                currency,
                req.user.id
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Payment order created",
            data: {
                key_id: razorpay.key_id,
                order_id: order.id,
                amount: order.amount,
                currency: order.currency,
                coupon_code: couponCode,
                referral_code: pricingQuote.referral_code,
                original_amount: originalAmount.toFixed(2),
                discount_amount: discountAmount.toFixed(2),
                coupon_discount_amount: pricingQuote.coupon_discount_amount.toFixed(2),
                referral_discount_amount: pricingQuote.referral_discount_amount.toFixed(2),
                referral_discount_percentage: pricingQuote.referral_discount_percentage.toFixed(2),
                final_amount: finalAmount.toFixed(2),
                course: {
                    id: course.id,
                    title: course.title,
                    price: originalAmount.toFixed(2),
                    currency_code: currency
                }
            }
        });
    } catch (error) {
        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        return next(error);
    } finally {
        if (client) {
            client.release();
        }
    }
}

// ==================================================
// VERIFY RAZORPAY PAYMENT
// POST /api/student/payments/verify
// ==================================================

async function verifyPayment(req, res, next) {
    const orderId = String(
        req.body?.razorpay_order_id || ""
    );

    const paymentGatewayId = String(
        req.body?.razorpay_payment_id || ""
    );

    const signature = String(
        req.body?.razorpay_signature || ""
    );

    if (!orderId || !paymentGatewayId || !signature) {
        return res.status(400).json({
            success: false,
            message:
                "Razorpay order, payment and signature are required"
        });
    }

    let razorpay;

    try {
        razorpay = getRazorpay();
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }

    // 1. Verify Razorpay checkout signature
    const expectedSignature = crypto
        .createHmac("sha256", razorpay.key_secret)
        .update(`${orderId}|${paymentGatewayId}`)
        .digest("hex");

    if (!safeEqualHex(signature, expectedSignature)) {
        return res.status(400).json({
            success: false,
            message: "Payment signature verification failed"
        });
    }

    let client;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        // 2. Find this order belonging to the logged-in student
        const paymentResult = await client.query(
            `SELECT
                p.id AS payment_id,
                p.enrollment_id,
                p.student_id,
                p.course_id,
                p.final_amount,
                p.currency_code,
                p.status AS payment_status,
                p.gateway_order_id,
                s.user_id,
                c.title AS course_title
             FROM payment.payment p
             JOIN learning.student s
               ON s.id = p.student_id
             JOIN learning.course c
               ON c.id = p.course_id
             WHERE p.gateway_order_id = $1
               AND p.soft_delete = FALSE
               AND s.user_id = $2
               AND s.soft_delete = FALSE
             LIMIT 1`,
            [orderId, req.user.id]
        );

        if (!paymentResult.rowCount) {
            return res.status(404).json({
                success: false,
                message:
                    "Payment order not found for this student"
            });
        }

        const paymentRow = paymentResult.rows[0];

        if (paymentRow.payment_status === "PAID") {
            await client.query("BEGIN");
            transactionStarted = true;
            await client.query(
                `SELECT id
                 FROM payment.payment
                 WHERE id = $1
                 FOR UPDATE`,
                [paymentRow.payment_id]
            );
            const redemption = await redeemReservedCouponForPaidPayment(
                client,
                paymentRow.payment_id,
                req.user.id
            );
            await recordReferralEarningForPaidEnrollment(
                client,
                paymentRow.payment_id,
                req.user.id
            );
            await client.query("COMMIT");
            transactionStarted = false;

            return res.status(200).json({
                success: true,
                already_verified: true,
                message: "Payment was already verified",
                data: {
                    enrollment_id: paymentRow.enrollment_id,
                    coupon_redemption_status: redemption?.status ?? null
                }
            });
        }

        if (paymentRow.payment_status !== "PENDING") {
            return res.status(409).json({
                success: false,
                message: "This payment is not pending"
            });
        }

        // 3. Verify the payment directly with Razorpay
        const gatewayPayment =
            await razorpay.client.payments.fetch(paymentGatewayId);

        const expectedPaise = Math.round(
            Number(paymentRow.final_amount) * 100
        );

        if (gatewayPayment.order_id !== orderId) {
            return res.status(400).json({
                success: false,
                message:
                    "Gateway payment does not belong to this order"
            });
        }

        if (gatewayPayment.status !== "captured") {
            return res.status(409).json({
                success: false,
                message:
                    "Payment is not captured yet. Course access has not been enabled."
            });
        }

        if (
            Number(gatewayPayment.amount) !== expectedPaise ||
            String(gatewayPayment.currency).toUpperCase() !==
                String(paymentRow.currency_code).toUpperCase()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Gateway payment amount or currency does not match the course price"
            });
        }

        // 4. Begin database transaction
        await client.query("BEGIN");
        transactionStarted = true;

        // 5. Lock payment record to prevent concurrent verification
        const lockedPayment = await client.query(
            `SELECT id, status
             FROM payment.payment
             WHERE id = $1
             FOR UPDATE`,
            [paymentRow.payment_id]
        );

        if (!lockedPayment.rowCount) {
            throw new Error("Payment record not found");
        }

        if (lockedPayment.rows[0].status === "PAID") {
            const redemption = await redeemReservedCouponForPaidPayment(
                client,
                paymentRow.payment_id,
                req.user.id
            );
            await recordReferralEarningForPaidEnrollment(
                client,
                paymentRow.payment_id,
                req.user.id
            );
            await client.query("COMMIT");
            transactionStarted = false;

            return res.status(200).json({
                success: true,
                already_verified: true,
                message: "Payment was already verified",
                data: {
                    enrollment_id: paymentRow.enrollment_id,
                    coupon_redemption_status: redemption?.status ?? null
                }
            });
        }

        if (lockedPayment.rows[0].status !== "PENDING") {
            throw new Error("This payment is not pending");
        }

        // 6. Record the successful gateway transaction before marking payment paid.
        const transactionUpdate = await client.query(
            `UPDATE payment.payment_transaction
             SET gateway_transaction_id = $1,
                 payment_method = $2,
                 status = 'SUCCESS',
                 gateway_status = $3,
                 gateway_response_code = $4,
                 gateway_response_message = $5,
                 gateway_response = $6::jsonb,
                 processed_at = NOW(),
                 updated_at = NOW(),
                 updated_by = $7
             WHERE payment_id = $8
               AND gateway_order_id = $9
               AND soft_delete = FALSE
             RETURNING id`,
            [
                paymentGatewayId,
                String(
                    gatewayPayment.method || "RAZORPAY"
                ).toUpperCase().slice(0, 30),
                gatewayPayment.status,
                String(gatewayPayment.status),
                "Payment captured and verified",
                JSON.stringify({
                    id: gatewayPayment.id,
                    order_id: gatewayPayment.order_id,
                    amount: gatewayPayment.amount,
                    currency: gatewayPayment.currency,
                    status: gatewayPayment.status,
                    method: gatewayPayment.method
                }),
                req.user.id,
                paymentRow.payment_id,
                orderId
            ]
        );

        if (transactionUpdate.rowCount !== 1) {
            throw new Error(
                "Payment was verified, but transaction update failed"
            );
        }

        const paymentUpdate = await client.query(
            `UPDATE payment.payment
             SET status = 'PAID',
                 paid_amount = final_amount,
                 payment_method = $1,
                 paid_at = NOW(),
                 failed_at = NULL,
                 failure_reason = NULL,
                 updated_at = NOW(),
                 updated_by = $2
             WHERE id = $3
               AND status = 'PENDING'
             RETURNING id`,
            [
                String(
                    gatewayPayment.method || "RAZORPAY"
                ).toUpperCase().slice(0, 30),
                req.user.id,
                paymentRow.payment_id
            ]
        );

        if (paymentUpdate.rowCount !== 1) {
            throw new Error("Unable to update the payment record");
        }

        // 7. Activate the enrollment only after payment verification
        // IMPORTANT: Check rowCount before committing.
        const enrollmentUpdate = await client.query(
            `UPDATE learning.enrollment
             SET status = 'ACTIVE',
                 start_date = COALESCE(start_date, CURRENT_DATE),
                 updated_at = NOW(),
                 updated_by = $1
             WHERE id = $2
               AND student_id = $3
               AND course_id = $4
               AND status = 'PENDING'
               AND soft_delete = FALSE
             RETURNING id`,
            [
                req.user.id,
                paymentRow.enrollment_id,
                paymentRow.student_id,
                paymentRow.course_id
            ]
        );

        if (enrollmentUpdate.rowCount !== 1) {
            throw new Error(
                "Payment was verified, but enrollment activation failed"
            );
        }

        const redemption = await redeemReservedCouponForPaidPayment(
            client,
            paymentRow.payment_id,
            req.user.id
        );

        await recordReferralEarningForPaidEnrollment(
            client,
            paymentRow.payment_id,
            req.user.id
        );

        // 9. Commit only when all database updates succeed
        await client.query("COMMIT");
        transactionStarted = false;

        try {
            await notificationRepository.createForUser(
                {
                    userId: paymentRow.user_id,
                    notificationType: "PAYMENT_SUCCESS",
                    title: "Payment successful",
                    message: `Your payment for ${paymentRow.course_title} was successful.`,
                    preferenceKey: "payments",
                    createdBy: paymentRow.user_id
                },
                client
            );
        } catch (notificationError) {
            console.error(
                "Failed to create the payment notification:",
                notificationError
            );
        }

        return res.status(200).json({
            success: true,
            message:
                "Payment verified. You are now enrolled in the course.",
            data: {
                enrollment_id: paymentRow.enrollment_id,
                course_id: paymentRow.course_id,
                payment_status: "PAID",
                enrollment_status: "ACTIVE",
                coupon_redemption_status: redemption?.status ?? null
            }
        });
    } catch (error) {
        if (client && transactionStarted) {
            await client.query("ROLLBACK").catch(() => {});
        }

        return next(error);
    } finally {
        if (client) {
            client.release();
        }
    }
}



function couponError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// Validate coupon from PostgreSQL and calculate the discount on the server.
// When lockCoupon=true, lock the coupon row to prevent concurrent over-redemption.
async function getCouponQuote(client, { code, student, course, price, lockCoupon = false }) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) throw couponError("Please enter a coupon code.");

    const couponResult = await client.query(
        `SELECT id, institution_id, coupon_code, discount_type,
                discount_value, minimum_amount, maximum_discount_amount,
                valid_from, valid_until, usage_limit, used_count
         FROM payment.coupon
         WHERE UPPER(BTRIM(coupon_code)) = $1
           AND is_active = TRUE
           AND soft_delete = FALSE
         LIMIT 1 ${lockCoupon ? "FOR UPDATE" : ""}`,
        [normalizedCode]
    );

    if (!couponResult.rowCount) throw couponError("Invalid coupon code.");
    const coupon = couponResult.rows[0];

    if (String(coupon.institution_id) !== String(student.institution_id)) {
        throw couponError("This coupon is not available for your institution.");
    }
    if (new Date(coupon.valid_from) > new Date() || new Date(coupon.valid_until) < new Date()) {
        throw couponError("This coupon is expired or not active yet.");
    }
    if (coupon.usage_limit != null && Number(coupon.used_count) >= Number(coupon.usage_limit)) {
        throw couponError("This coupon has reached its usage limit.");
    }
    if (price < Number(coupon.minimum_amount)) {
        throw couponError(`Minimum purchase amount is ${Number(coupon.minimum_amount).toFixed(2)}.`);
    }

    const courseRestriction = await client.query(
        `SELECT
            EXISTS (
                SELECT 1 FROM payment.coupon_course
                WHERE coupon_id = $1 AND course_id = $2
                  AND is_active = TRUE
            ) AS matches_course`,
        [coupon.id, course.id]
    );
    if (!courseRestriction.rows[0].matches_course) {
        throw couponError("This coupon is not valid for this course.");
    }

    const studentRestriction = await client.query(
        `SELECT
            EXISTS (
                SELECT 1 FROM payment.coupon_student
                WHERE coupon_id = $1
                  AND is_active = TRUE
                  AND soft_delete = FALSE
            ) AS has_student_restrictions,
            EXISTS (
                SELECT 1 FROM payment.coupon_student
                WHERE coupon_id = $1 AND student_id = $2
                  AND is_active = TRUE AND soft_delete = FALSE
            ) AS matches_student`,
        [coupon.id, student.id]
    );
    const { has_student_restrictions: hasStudentRestrictions, matches_student: matchesStudent } =
        studentRestriction.rows[0];
    if (hasStudentRestrictions && !matchesStudent) {
        throw couponError("This coupon is not assigned to your student account.");
    }

    // A coupon can be claimed only once per student. Once a student redeems it
    // on any course, it must not be offered or accepted again for another course.
    const redemptionCheck = await client.query(
        `SELECT EXISTS (
            SELECT 1
            FROM payment.coupon_redemption
            WHERE coupon_id = $1
              AND student_id = $2
              AND status = 'REDEEMED'
              AND soft_delete = FALSE
        ) AS already_redeemed`,
        [coupon.id, student.id]
    );
    if (redemptionCheck.rows[0].already_redeemed) {
        throw couponError("You have already redeemed this coupon. It cannot be used again on another course.");
    }

    let discount = 0;
    const discountValue = Number(coupon.discount_value);
    if (coupon.discount_type === "PERCENTAGE") {
        discount = price * discountValue / 100;
        if (coupon.maximum_discount_amount != null) {
            discount = Math.min(discount, Number(coupon.maximum_discount_amount));
        }
    } else if (coupon.discount_type === "FIXED") {
        discount = discountValue;
    } else {
        throw couponError("This coupon has an unsupported discount type.");
    }

    discount = Math.min(price, Math.max(0, Math.round((discount + Number.EPSILON) * 100) / 100));
    const finalAmount = Math.max(0, Math.round((price - discount + Number.EPSILON) * 100) / 100);

    return {
        id: coupon.id,
        coupon_code: coupon.coupon_code,
        discount_amount: discount,
        final_amount: finalAmount,
        original_amount: Math.round((price + Number.EPSILON) * 100) / 100
    };
}

// Sum of the referral discount this student already consumed on paid
// enrollments (same currency). The referral discount is a one-time benefit.
async function getStudentUsedReferralDiscount(client, studentId, currencyCode) {
    const result = await client.query(
        `SELECT COALESCE(SUM(referral_discount_amount), 0)::numeric AS used_discount
         FROM payment.payment
         WHERE student_id = $1
           AND status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
           AND soft_delete = FALSE
           AND referral_discount_amount > 0
           AND UPPER(currency_code) = UPPER($2)`,
        [studentId, currencyCode || "INR"]
    );
    return Math.max(0, Number(result.rows[0]?.used_discount || 0));
}

function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function getReferralQuote(client, { code, student, course, price }) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) throw couponError("Please enter an instructor referral code.");

    const result = await client.query(
        `SELECT i.id AS instructor_id,
                i.referral_code,
                iu.id AS instructor_user_id,
                COALESCE(settings.student_discount_percentage, 0)::numeric AS student_discount_percentage,
                COALESCE(settings.student_discount_amount, 0)::numeric AS student_discount_amount,
                COALESCE(settings.instructor_incentive_amount, 0)::numeric AS instructor_incentive_amount
         FROM learning.instructor i
         JOIN olp_auth."user" iu ON iu.id = i.user_id
         LEFT JOIN payroll.referral_settings settings
           ON settings.currency_code = UPPER(COALESCE($2, 'INR'))
          AND settings.is_active = TRUE
         WHERE UPPER(BTRIM(i.referral_code)) = $1
            AND i.is_active = TRUE
            AND i.soft_delete = FALSE
            AND iu.is_active = TRUE
            AND iu.soft_delete = FALSE
            AND UPPER(iu.approval_status) = 'APPROVED'
         LIMIT 1`,
        [normalizedCode, course.currency_code || "INR"]
    );

    if (!result.rowCount) throw couponError("This instructor referral code is invalid or inactive.");
    if (String(result.rows[0].instructor_user_id) === String(student.user_id)) {
        throw couponError("You cannot use your own instructor referral code.");
    }

    const configuredPercentage = Math.min(
        100,
        Math.max(0, Number(result.rows[0].student_discount_percentage || 0))
    );
    const configuredFixedDiscount = Math.max(0, Number(result.rows[0].student_discount_amount || 0));
    const configuredIncentive = Math.max(0, Number(result.rows[0].instructor_incentive_amount || 0));

    // The referral discount is one-time per student: deduct whatever was already
    // consumed on earlier paid enrollments. When the configured amount is fully
    // consumed (e.g. the discount was smaller than the first course price), the
    // discount is exhausted, but the instructor incentive still accrues for every
    // paid enrollment by this student.
    const usedDiscountAmount = await getStudentUsedReferralDiscount(
        client,
        student.id,
        course.currency_code || "INR"
    );
    let rawDiscount;
    let discountExhausted;
    if (configuredFixedDiscount > 0) {
        const remainingFixedDiscount = roundMoney(
            Math.max(0, configuredFixedDiscount - usedDiscountAmount)
        );
        rawDiscount = remainingFixedDiscount;
        discountExhausted = remainingFixedDiscount <= 0;
    } else {
        rawDiscount = usedDiscountAmount > 0 ? 0 : Number(price) * configuredPercentage / 100;
        discountExhausted = usedDiscountAmount > 0;
    }
    const discountAmount = Math.min(Number(price), Math.max(0, rawDiscount));

    return {
        instructor_id: result.rows[0].instructor_id,
        referral_code: result.rows[0].referral_code,
        discount_percentage: roundMoney(configuredPercentage),
        discount_amount: roundMoney(discountAmount),
        incentive_amount: roundMoney(configuredIncentive),
        discount_exhausted: discountExhausted,
        used_discount_amount: roundMoney(usedDiscountAmount)
    };
}

async function getStoredStudentReferralQuote(client, { student, course, price }) {
    const result = await client.query(
        `SELECT i.referral_code, i.user_id AS instructor_user_id
         FROM learning.student s
         JOIN learning.instructor i ON i.id = s.referred_by_instructor_id
         JOIN olp_auth."user" iu ON iu.id = i.user_id
         WHERE s.id = $1
           AND s.soft_delete = FALSE
           AND i.is_active = TRUE
           AND i.soft_delete = FALSE
           AND iu.is_active = TRUE
           AND iu.soft_delete = FALSE
           AND UPPER(iu.approval_status) = 'APPROVED'
           AND NULLIF(BTRIM(i.referral_code), '') IS NOT NULL
         LIMIT 1`,
        [student.id]
    );

    if (!result.rowCount) return null;
    if (String(result.rows[0].instructor_user_id) === String(student.user_id)) {
        return null;
    }

    return getReferralQuote(client, {
        code: result.rows[0].referral_code,
        student,
        course,
        price
    });
}

function combineDiscountQuotes({ price, couponQuote = null, referralQuote = null }) {
    const originalAmount = Math.round((Number(price) + Number.EPSILON) * 100) / 100;
    const couponDiscountAmount = Math.min(
        originalAmount,
        Math.max(0, Number(couponQuote?.discount_amount || 0))
    );
    const referralDiscountAmount = Math.min(
        Math.max(0, originalAmount - couponDiscountAmount),
        Math.max(0, Number(referralQuote?.discount_amount || 0))
    );
    const totalDiscountAmount = Math.round(
        (couponDiscountAmount + referralDiscountAmount + Number.EPSILON) * 100
    ) / 100;

    return {
        original_amount: originalAmount,
        coupon_discount_amount: Math.round((couponDiscountAmount + Number.EPSILON) * 100) / 100,
        referral_discount_amount: Math.round((referralDiscountAmount + Number.EPSILON) * 100) / 100,
        discount_amount: totalDiscountAmount,
        final_amount: Math.max(0, Math.round((originalAmount - totalDiscountAmount + Number.EPSILON) * 100) / 100),
        coupon_code: couponQuote?.coupon_code ?? null,
        referral_code: referralQuote?.referral_code ?? null,
        referral_discount_percentage: referralQuote?.discount_percentage ?? 0,
        referred_by_instructor_id: referralQuote?.instructor_id ?? null,
        referral_incentive_amount: referralQuote?.incentive_amount ?? 0
    };
}

async function recordReferralEarningForPaidEnrollment(client, paymentId, userId) {
    await client.query(
        `INSERT INTO payroll.instructor_referral_earning
            (enrollment_id, payment_id, instructor_id, student_id, course_id,
             compensation_id, referral_code_snapshot, incentive_amount,
             status, earned_at, created_by)
         SELECT e.id, p.id, e.referred_by_instructor_id, e.student_id, e.course_id,
                NULL, e.referral_code_snapshot, p.referral_incentive_amount,
                'PENDING', COALESCE(p.paid_at, NOW()), $2
         FROM payment.payment p
         JOIN learning.enrollment e ON e.id = p.enrollment_id
         WHERE p.id = $1
           AND p.status = 'PAID'
           AND e.referred_by_instructor_id IS NOT NULL
           AND NULLIF(BTRIM(e.referral_code_snapshot), '') IS NOT NULL
           AND p.referral_incentive_amount > 0
         ON CONFLICT (enrollment_id) DO NOTHING`,
        [paymentId, userId]
    );

    // Remember the referring instructor on the student profile (first referral
    // wins). Even after the one-time referral discount is consumed, every later
    // paid enrollment by this student keeps earning that instructor incentives.
    await client.query(
        `UPDATE learning.student s
         SET referred_by_instructor_id = e.referred_by_instructor_id,
             referred_at = COALESCE(s.referred_at, NOW()),
             updated_by = $2
         FROM learning.enrollment e
         JOIN payment.payment p ON p.enrollment_id = e.id
         WHERE p.id = $1
           AND p.status = 'PAID'
           AND e.referred_by_instructor_id IS NOT NULL
           AND s.id = e.student_id
           AND s.referred_by_instructor_id IS NULL`,
        [paymentId, userId]
    );
}

// Referral eligibility for the checkout UI. A student whose one-time referral
// discount is already consumed must not be able to enter a referral code again,
// even though the instructor incentive keeps accruing for that student.
async function getStudentReferralStatus(client, { student, course, price }) {
    const currencyCode = String(course.currency_code || "INR").toUpperCase();

    const storedResult = await client.query(
        `SELECT i.referral_code, iu.id AS instructor_user_id
         FROM learning.student s
         JOIN learning.instructor i ON i.id = s.referred_by_instructor_id
         JOIN olp_auth."user" iu ON iu.id = i.user_id
         WHERE s.id = $1
           AND s.soft_delete = FALSE
           AND i.is_active = TRUE
           AND i.soft_delete = FALSE
           AND iu.is_active = TRUE
           AND iu.soft_delete = FALSE
           AND UPPER(iu.approval_status) = 'APPROVED'
           AND NULLIF(BTRIM(i.referral_code), '') IS NOT NULL
         LIMIT 1`,
        [student.id]
    );

    let storedReferralCode = null;
    if (
        storedResult.rowCount &&
        String(storedResult.rows[0].instructor_user_id) !== String(student.user_id)
    ) {
        storedReferralCode = storedResult.rows[0].referral_code;
    }

    const settingsResult = await client.query(
        `SELECT COALESCE(student_discount_percentage, 0)::numeric AS student_discount_percentage,
                COALESCE(student_discount_amount, 0)::numeric AS student_discount_amount
         FROM payroll.referral_settings
         WHERE currency_code = $1
           AND is_active = TRUE
         LIMIT 1`,
        [currencyCode]
    );
    const settings = settingsResult.rows[0] || {
        student_discount_percentage: 0,
        student_discount_amount: 0
    };
    const configuredPercentage = Math.min(100, Math.max(0, Number(settings.student_discount_percentage || 0)));
    const configuredFixedDiscount = Math.max(0, Number(settings.student_discount_amount || 0));

    const usedDiscountAmount = await getStudentUsedReferralDiscount(
        client,
        student.id,
        currencyCode
    );

    let discountAmount = 0;
    let discountExhausted;
    if (configuredFixedDiscount > 0) {
        const remainingFixedDiscount = roundMoney(
            Math.max(0, configuredFixedDiscount - usedDiscountAmount)
        );
        discountExhausted = remainingFixedDiscount <= 0;
        discountAmount = Math.min(Number(price), remainingFixedDiscount);
    } else {
        discountExhausted = usedDiscountAmount > 0;
        discountAmount = discountExhausted
            ? 0
            : Math.min(Number(price), Number(price) * configuredPercentage / 100);
    }

    return {
        available: !discountExhausted,
        referral_code: storedReferralCode,
        discount_amount: roundMoney(Math.max(0, discountAmount)),
        currency_code: currencyCode,
        message: discountExhausted
            ? "Your instructor referral discount has already been used on a previous enrollment."
            : null
    };
}

// Select the best active coupon mapped to the student's institution,
// requested course, and student account.
async function getAutomaticCouponQuote(
    client,
    { student, course, price, lockCoupon = false }
) {
    if (!student?.institution_id || !course?.id) return null;

    const candidates = await client.query(
        `SELECT c.coupon_code
         FROM payment.coupon c
         WHERE c.institution_id = $1
           AND c.is_active = TRUE
           AND c.soft_delete = FALSE
           AND EXISTS (
               SELECT 1
               FROM payment.coupon_course cc
               WHERE cc.coupon_id = c.id
                 AND cc.course_id = $2
                 AND cc.is_active = TRUE
           )
         ORDER BY c.id DESC`,
        [student.institution_id, course.id]
    );

    const quotes = [];
    for (const candidate of candidates.rows) {
        try {
            quotes.push(await getCouponQuote(client, {
                code: candidate.coupon_code,
                student,
                course,
                price,
                lockCoupon
            }));
        } catch (error) {
            // Expired, exhausted, student-restricted, or otherwise
            // ineligible mappings should not prevent another coupon
            // mapped to this course from being selected.
            if (!error.statusCode) throw error;
        }
    }

    quotes.sort((left, right) =>
        Number(left.final_amount) - Number(right.final_amount) ||
        String(left.coupon_code).localeCompare(String(right.coupon_code))
    );

    return quotes[0] || null;
}

// GET /api/student/payments/automatic-coupon?course_id=...
async function getAutomaticCoupon(req, res, next) {
    const courseId = Number(req.query?.course_id ?? req.query?.courseId);
    if (!Number.isSafeInteger(courseId) || courseId <= 0) {
        return res.status(400).json({
            success: false,
            message: "A valid course_id is required."
        });
    }

    let client;
    try {
        client = await pool.connect();

        const studentResult = await client.query(
            `SELECT id, user_id, institution_id, register_number, student_code
             FROM learning.student
             WHERE user_id = $1 AND soft_delete = FALSE AND is_active = TRUE
             LIMIT 1`,
            [req.user.id]
        );
        if (!studentResult.rowCount) {
            throw couponError("An active student profile is required.", 403);
        }

        const courseResult = await client.query(
            `SELECT id, price, currency_code, course_type
             FROM learning.course
             WHERE id = $1 AND soft_delete = FALSE AND is_active = TRUE
               AND status = 'PUBLISHED'
             LIMIT 1`,
            [courseId]
        );
        if (!courseResult.rowCount) {
            throw couponError("Published course not found.", 404);
        }

        const student = studentResult.rows[0];
        const course = courseResult.rows[0];
        const price = Number(course.price);
        const isPaidCourse = String(course.course_type).toUpperCase() === "PAID" &&
            Number.isFinite(price) &&
            price > 0;
        const quote = isPaidCourse
            ? await getAutomaticCouponQuote(client, {
                student,
                course,
                price
            })
            : null;
        const referralStatus = isPaidCourse
            ? await getStudentReferralStatus(client, { student, course, price })
            : null;

        return res.status(200).json({
            success: true,
            message: quote
                ? "Institution coupon found for this course."
                : "No coupon is available for your account and this course.",
            data: quote
                ? {
                    coupon_code: quote.coupon_code,
                    discount_amount: quote.discount_amount,
                    final_amount: quote.final_amount,
                    original_amount: quote.original_amount,
                    currency_code: String(course.currency_code || "INR").toUpperCase()
                }
                : null,
            referral: referralStatus
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }
        return next(error);
    } finally {
        if (client) client.release();
    }
}

// Finalize a reserved coupon only after the related payment is committed as PAID.
// The row lock and status guard make this safe to call more than once.
async function redeemReservedCouponForPaidPayment(client, paymentId, userId) {
    const latestResult = await client.query(
        `SELECT id, coupon_id, status
         FROM payment.coupon_redemption
         WHERE payment_id = $1
           AND soft_delete = FALSE
         ORDER BY id DESC
         LIMIT 1
         FOR UPDATE`,
        [paymentId]
    );

    const latest = latestResult.rows[0];
    if (!latest || latest.status !== "RESERVED") return null;

    const updated = await client.query(
        `UPDATE payment.coupon_redemption
         SET status = 'REDEEMED',
             redeemed_at = COALESCE(redeemed_at, NOW()),
             cancelled_at = NULL,
             cancellation_reason = NULL,
             is_active = TRUE,
             updated_at = NOW(),
             updated_by = $1
         WHERE id = $2
           AND status = 'RESERVED'
           AND soft_delete = FALSE
         RETURNING coupon_id`,
        [userId, latest.id]
    );

    if (!updated.rowCount) return null;

    await incrementCouponUsageForPaidPayment(
        client,
        updated.rows[0].coupon_id,
        userId
    );

    return {
        id: latest.id,
        coupon_id: String(updated.rows[0].coupon_id),
        status: "REDEEMED"
    };
}

async function incrementCouponUsageForPaidPayment(client, couponId, userId) {
    const usageUpdate = await client.query(
        `UPDATE payment.coupon
         SET used_count = used_count + 1,
             updated_at = NOW(),
             updated_by = $1
         WHERE id = $2
           AND (usage_limit IS NULL OR used_count < usage_limit)
         RETURNING id`,
        [userId, couponId]
    );

    if (usageUpdate.rowCount !== 1) {
        throw couponError(
            "Coupon usage could not be recorded because its usage limit has been reached.",
            409
        );
    }
}

async function reserveCheckoutPricing(client, {
    student,
    course,
    couponQuote = null,
    referralQuote = null,
    pricingQuote,
    userId
}) {
    const enrollmentResult = await client.query(
        `SELECT id, status, soft_delete
         FROM learning.enrollment
         WHERE student_id = $1 AND course_id = $2
         LIMIT 1
         FOR UPDATE`,
        [student.id, course.id]
    );

    let enrollmentId;
    if (enrollmentResult.rowCount) {
        const enrollment = enrollmentResult.rows[0];
        if (!enrollment.soft_delete && ["ACTIVE", "COMPLETED"].includes(enrollment.status)) {
            throw couponError("You are already enrolled in this course.", 409);
        }
        enrollmentId = enrollment.id;
        await client.query(
            `UPDATE learning.enrollment
             SET status = 'PENDING', soft_delete = FALSE, deleted_at = NULL,
                 cancelled_at = NULL, cancellation_reason = NULL,
                 updated_at = NOW(), updated_by = $1
             WHERE id = $2`,
            [userId, enrollmentId]
        );
    } else {
        const inserted = await client.query(
            `INSERT INTO learning.enrollment
                (enrollment_number, student_id, course_id, enrollment_date, status, created_by)
             VALUES ($1, $2, $3, NOW(), 'PENDING', $4)
             RETURNING id`,
            [makeNumber("ENR"), student.id, course.id, userId]
        );
        enrollmentId = inserted.rows[0].id;
    }

    await client.query(
        `UPDATE learning.enrollment
         SET referred_by_instructor_id = $1,
             referral_code_snapshot = $2,
             referral_discount_percentage = $3,
             referral_discount_amount = $4,
             updated_at = NOW(), updated_by = $5
         WHERE id = $6`,
        [
            referralQuote?.instructor_id ?? null,
            referralQuote?.referral_code ?? null,
            pricingQuote.referral_discount_percentage.toFixed(2),
            pricingQuote.referral_discount_amount.toFixed(2),
            userId,
            enrollmentId
        ]
    );

    const paymentResult = await client.query(
        `SELECT id, status
         FROM payment.payment
         WHERE enrollment_id = $1 AND soft_delete = FALSE
         ORDER BY id DESC
         LIMIT 1
         FOR UPDATE`,
        [enrollmentId]
    );

    let paymentId;
    const currency = String(course.currency_code || "INR").toUpperCase();
    if (paymentResult.rowCount) {
        const existingPayment = paymentResult.rows[0];
        if (!["PENDING", "FAILED", "CANCELLED"].includes(existingPayment.status)) {
            throw couponError("This course already has a completed payment.", 409);
        }
        paymentId = existingPayment.id;
        await client.query(
            `UPDATE payment.payment
             SET original_amount = $1, discount_amount = $2,
                 referral_discount_amount = $3, coupon_discount_amount = $4,
                 referral_incentive_amount = $5, tax_amount = 0,
                 final_amount = $6, paid_amount = 0, currency_code = $7,
                 status = 'PENDING', payment_method = NULL, payment_gateway = NULL,
                 gateway_order_id = NULL, payment_due_at = NULL, paid_at = NULL,
                 failed_at = NULL, failure_reason = NULL, cancelled_at = NULL,
                 cancellation_reason = NULL, soft_delete = FALSE,
                 updated_at = NOW(), updated_by = $8
             WHERE id = $9`,
            [pricingQuote.original_amount.toFixed(2), pricingQuote.discount_amount.toFixed(2),
                pricingQuote.referral_discount_amount.toFixed(2),
                pricingQuote.coupon_discount_amount.toFixed(2),
                pricingQuote.referral_incentive_amount.toFixed(2),
                pricingQuote.final_amount.toFixed(2), currency, userId, paymentId]
        );
    } else {
        const inserted = await client.query(
            `INSERT INTO payment.payment
                (payment_number, enrollment_id, student_id, course_id, currency_code,
                 original_amount, discount_amount, referral_discount_amount,
                 coupon_discount_amount, referral_incentive_amount, tax_amount,
                 final_amount, paid_amount, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, 0, 'PENDING', $12)
             RETURNING id`,
            [makeNumber("PAY"), enrollmentId, student.id, course.id, currency,
                pricingQuote.original_amount.toFixed(2), pricingQuote.discount_amount.toFixed(2),
                pricingQuote.referral_discount_amount.toFixed(2),
                pricingQuote.coupon_discount_amount.toFixed(2),
                pricingQuote.referral_incentive_amount.toFixed(2),
                pricingQuote.final_amount.toFixed(2), userId]
        );
        paymentId = inserted.rows[0].id;
    }

    if (!couponQuote?.id) {
        await client.query(
            `UPDATE payment.coupon_redemption
             SET status = 'CANCELLED', cancelled_at = NOW(),
                 cancellation_reason = 'Checkout continued without a coupon',
                 is_active = FALSE, updated_at = NOW(), updated_by = $1
             WHERE payment_id = $2 AND status = 'RESERVED' AND soft_delete = FALSE`,
            [userId, paymentId]
        );
        return { enrollment_id: enrollmentId, payment_id: paymentId };
    }

    const lockedCoupon = await client.query(
        `SELECT usage_limit, used_count
         FROM payment.coupon
         WHERE id = $1 AND is_active = TRUE AND soft_delete = FALSE
         FOR UPDATE`,
        [couponQuote.id]
    );
    if (!lockedCoupon.rowCount) throw couponError("This coupon is no longer available.", 409);
    if (lockedCoupon.rows[0].usage_limit != null) {
        const reserved = await client.query(
            `SELECT COUNT(*)::int AS reserved_count
             FROM payment.coupon_redemption r
             JOIN payment.payment p ON p.id = r.payment_id
             WHERE r.coupon_id = $1 AND r.payment_id <> $2
               AND r.status = 'RESERVED' AND r.is_active = TRUE
               AND r.soft_delete = FALSE
               AND r.applied_at >= NOW() - INTERVAL '30 minutes'
               AND p.status = 'PENDING' AND p.soft_delete = FALSE`,
            [couponQuote.id, paymentId]
        );
        if (Number(lockedCoupon.rows[0].used_count || 0) +
            Number(reserved.rows[0]?.reserved_count || 0) >= Number(lockedCoupon.rows[0].usage_limit)) {
            throw couponError("This coupon has reached its usage limit.", 409);
        }
    }

    const registerSnapshot = String(student.register_number || student.student_code || "").trim();
    if (!registerSnapshot) throw couponError("Student register number is missing. Contact the administrator.");

    const prior = await client.query(
        `SELECT id FROM payment.coupon_redemption
         WHERE payment_id = $1 AND status = 'RESERVED' AND soft_delete = FALSE
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [paymentId]
    );
    if (prior.rowCount) {
        await client.query(
            `UPDATE payment.coupon_redemption
             SET coupon_id = $1, enrollment_id = $2, student_id = $3,
                 coupon_code_snapshot = $4, register_number_snapshot = $5,
                 original_amount = $6, discount_amount = $7, final_amount = $8,
                 applied_at = NOW(), is_active = TRUE, updated_at = NOW(), updated_by = $9
             WHERE id = $10`,
            [couponQuote.id, enrollmentId, student.id, couponQuote.coupon_code,
                registerSnapshot, couponQuote.original_amount.toFixed(2),
                couponQuote.discount_amount.toFixed(2), couponQuote.final_amount.toFixed(2),
                userId, prior.rows[0].id]
        );
    } else {
        await client.query(
            `INSERT INTO payment.coupon_redemption
                (coupon_id, payment_id, enrollment_id, student_id, coupon_code_snapshot,
                 register_number_snapshot, original_amount, discount_amount, final_amount,
                 status, applied_at, created_by, updated_by, is_active, soft_delete)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'RESERVED', NOW(), $10, $10, TRUE, FALSE)`,
            [couponQuote.id, paymentId, enrollmentId, student.id, couponQuote.coupon_code,
                registerSnapshot, couponQuote.original_amount.toFixed(2),
                couponQuote.discount_amount.toFixed(2), couponQuote.final_amount.toFixed(2), userId]
        );
    }

    return { enrollment_id: enrollmentId, payment_id: paymentId };
}

// Applying discount codes reserves the pending checkout and any coupon usage.


// POST /api/student/payments/apply-coupon
async function applyCoupon(req, res, next) {
    const courseId = Number(req.body?.course_id ?? req.body?.courseId);
    const couponCode = req.body?.coupon_code ?? req.body?.code;
    const referralCode = req.body?.referral_code ?? req.body?.referralCode;
    if (!Number.isSafeInteger(courseId) || courseId <= 0) {
        return res.status(400).json({ success: false, message: "A valid course_id is required." });
    }
    if (!String(couponCode || "").trim() && !String(referralCode || "").trim()) {
        return res.status(400).json({ success: false, message: "Enter a coupon code, an instructor referral code, or both." });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const studentResult = await client.query(
            `SELECT id, user_id, institution_id, register_number, student_code
             FROM learning.student
             WHERE user_id = $1 AND soft_delete = FALSE AND is_active = TRUE
             LIMIT 1`,
            [req.user.id]
        );
        if (!studentResult.rowCount) throw couponError("An active student profile is required.", 403);

        const courseResult = await client.query(
            `SELECT id, price, currency_code, course_type
             FROM learning.course
             WHERE id = $1 AND soft_delete = FALSE AND is_active = TRUE
               AND status = 'PUBLISHED'
             LIMIT 1`,
            [courseId]
        );
        if (!courseResult.rowCount) throw couponError("Published course not found.", 404);

        const student = studentResult.rows[0];
        const course = courseResult.rows[0];
        const price = Number(course.price);
        if (course.course_type !== "PAID" || !Number.isFinite(price) || price <= 0) {
            throw couponError("Discount codes can only be applied to paid courses.");
        }

        const couponQuote = String(couponCode || "").trim()
            ? await getCouponQuote(client, { code: couponCode, student, course, price, lockCoupon: true })
            : await getAutomaticCouponQuote(client, {
                student, course, price, lockCoupon: true
            });
        const referralQuote = String(referralCode || "").trim()
            ? await getReferralQuote(client, { code: referralCode, student, course, price })
            : await getStoredStudentReferralQuote(client, { student, course, price });
        const pricingQuote = combineDiscountQuotes({ price, couponQuote, referralQuote });
        const checkout = await reserveCheckoutPricing(client, {
            student, course, couponQuote, referralQuote, pricingQuote, userId: req.user.id
        });
        await client.query("COMMIT");
        return res.status(200).json({
            success: true,
            message: "Discounts applied and pricing reserved for checkout.",
            data: {
                coupon_code: pricingQuote.coupon_code,
                referral_code: pricingQuote.referral_code,
                referral_discount_exhausted: Boolean(referralQuote?.discount_exhausted),
                coupon_discount_amount: pricingQuote.coupon_discount_amount,
                referral_discount_amount: pricingQuote.referral_discount_amount,
                referral_discount_percentage: pricingQuote.referral_discount_percentage,
                discount_amount: pricingQuote.discount_amount,
                final_amount: pricingQuote.final_amount,
                original_amount: pricingQuote.original_amount,
                currency_code: String(course.currency_code || "INR").toUpperCase(),
                redemption_status: "RESERVED",
                ...checkout
            }
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        return next(error);
    } finally {
        if (client) client.release();
    }
}

// POST /api/student/payments/demo-checkout
// This is a simulated purchase only. No real money is collected.
async function confirmDemoCheckout(req, res, next) {
    const requestedCourseIds = req.body?.course_ids ?? req.body?.courseIds;
    const cartCheckout = Array.isArray(requestedCourseIds);
    const courseIds = cartCheckout
        ? requestedCourseIds.map(Number)
        : [Number(req.body?.course_id ?? req.body?.courseId)];
    const couponCode = req.body?.coupon_code ?? req.body?.code ?? null;
    const referralCode = req.body?.referral_code ?? req.body?.referralCode ?? null;
    const couponCodesByCourse =
        req.body?.coupon_codes_by_course ?? req.body?.couponCodesByCourse ?? null;
    const referralCodesByCourse =
        req.body?.referral_codes_by_course ?? req.body?.referralCodesByCourse ?? null;

    if (
        !courseIds.length ||
        courseIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
        new Set(courseIds).size !== courseIds.length
    ) {
        return res.status(400).json({
            success: false,
            message: cartCheckout
                ? "A non-empty list of unique, valid course IDs is required."
                : "A valid course_id is required."
        });
    }
    if (couponCodesByCourse !== null && (
        typeof couponCodesByCourse !== "object" ||
        Array.isArray(couponCodesByCourse) ||
        Object.keys(couponCodesByCourse).some((id) =>
            !courseIds.includes(Number(id)) ||
            typeof couponCodesByCourse[id] !== "string" ||
            !couponCodesByCourse[id].trim()
        )
    )) {
        return res.status(400).json({
            success: false,
            message: "Coupon codes must be valid strings mapped to selected courses."
        });
    }
    if (referralCodesByCourse !== null && (
        typeof referralCodesByCourse !== "object" ||
        Array.isArray(referralCodesByCourse) ||
        Object.keys(referralCodesByCourse).some((id) =>
            !courseIds.includes(Number(id)) ||
            typeof referralCodesByCourse[id] !== "string" ||
            !referralCodesByCourse[id].trim()
        )
    )) {
        return res.status(400).json({
            success: false,
            message: "Referral codes must be valid strings mapped to selected courses."
        });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const studentResult = await client.query(
            `SELECT id, user_id, institution_id, register_number, student_code
             FROM learning.student
             WHERE user_id = $1 AND soft_delete = FALSE AND is_active = TRUE
             LIMIT 1`,
            [req.user.id]
        );
        if (!studentResult.rowCount) throw couponError("Active student profile not found.", 403);
        const student = studentResult.rows[0];
        const studentId = student.id;

        const courseResult = await client.query(
            `SELECT id, title, price, currency_code, course_type, max_students
             FROM learning.course
             WHERE id = ANY($1::int[]) AND soft_delete = FALSE AND is_active = TRUE
               AND status = 'PUBLISHED'
             ORDER BY id
             FOR UPDATE`,
            [courseIds]
        );
        if (courseResult.rowCount !== courseIds.length) {
            throw couponError("One or more selected courses are no longer available.", 404);
        }

        const coursesById = new Map(
            courseResult.rows.map((course) => [Number(course.id), course])
        );
        const courses = courseIds.map((id) => coursesById.get(id));
        if (courses.some((course) => {
            const price = Number(course.price);
            return course.course_type !== "PAID" || !Number.isFinite(price) || price <= 0;
        })) {
            throw couponError("Every selected course must have a valid paid-course price.");
        }

        const currencies = new Set(
            courses.map((course) => String(course.currency_code || "INR").toUpperCase())
        );
        if (currencies.size !== 1) {
            throw couponError("All courses in one checkout must use the same currency.");
        }

        const checkoutResults = [];
        let totalOriginalCents = 0;
        let totalDiscountCents = 0;
        let totalFinalCents = 0;

        for (const course of courses) {
            const courseId = Number(course.id);
            const price = Number(course.price);

            const existingResult = await client.query(
                `SELECT id, status FROM learning.enrollment
                 WHERE student_id = $1 AND course_id = $2
                   AND soft_delete = FALSE
                   AND status IN ('ACTIVE', 'COMPLETED')
                 LIMIT 1 FOR UPDATE`,
                [studentId, courseId]
            );
            if (existingResult.rowCount) {
                if (cartCheckout) {
                    throw couponError(
                        `You are already enrolled in ${course.title}. Remove it from your cart before checkout.`,
                        409
                    );
                }
                await client.query("COMMIT");
                return res.status(200).json({
                    success: true,
                    already_enrolled: true,
                    message: "You are already enrolled in this course.",
                    data: { enrollment_id: existingResult.rows[0].id, enrollment_status: existingResult.rows[0].status }
                });
            }

            // The student/course pair is unique even when an enrollment is soft-deleted.
            // Reuse that historical row instead of inserting a duplicate enrollment.
            const historicalEnrollment = await client.query(
                `SELECT id, status, soft_delete
                 FROM learning.enrollment
                 WHERE student_id = $1 AND course_id = $2
                 LIMIT 1
                 FOR UPDATE`,
                [studentId, courseId]
            );

            if (historicalEnrollment.rowCount) {
                const oldEnrollment = historicalEnrollment.rows[0];
                const paidPayment = await client.query(
                    `SELECT id
                     FROM payment.payment
                     WHERE enrollment_id = $1
                       AND status = 'PAID'
                       AND soft_delete = FALSE
                     LIMIT 1
                     FOR UPDATE`,
                    [oldEnrollment.id]
                );

                // A previously paid course should be restored without charging again.
                if (paidPayment.rowCount) {
                    const restoredStatus = oldEnrollment.status === 'COMPLETED'
                        ? 'COMPLETED'
                        : 'ACTIVE';
                    await client.query(
                        `UPDATE learning.enrollment
                         SET status = $1,
                             soft_delete = FALSE,
                             deleted_at = NULL,
                             cancelled_at = NULL,
                             cancellation_reason = NULL,
                             start_date = COALESCE(start_date, CURRENT_DATE),
                             updated_at = NOW(),
                             updated_by = $2
                         WHERE id = $3`,
                        [restoredStatus, req.user.id, oldEnrollment.id]
                    );
                    if (cartCheckout) {
                        checkoutResults.push({
                            course_id: courseId,
                            enrollment_id: oldEnrollment.id,
                            payment_id: paidPayment.rows[0].id,
                            enrollment_status: restoredStatus,
                            payment_status: "PAID",
                            transaction_status: "ALREADY_PAID",
                            original_amount: 0,
                            discount_amount: 0,
                            final_amount: 0,
                            currency_code: String(course.currency_code || "INR").toUpperCase(),
                            restored: true
                        });
                        continue;
                    }
                    await client.query("COMMIT");
                    return res.status(200).json({
                        success: true,
                        already_enrolled: true,
                        restored: true,
                        message: "Your previous enrollment has been restored. No new payment was taken.",
                        data: {
                            enrollment_id: oldEnrollment.id,
                            enrollment_status: restoredStatus,
                            payment_status: "PAID"
                        }
                    });
                }

                // No successful payment exists: reuse the same row as a pending checkout.
                await client.query(
                    `UPDATE learning.enrollment
                     SET status = 'PENDING',
                         soft_delete = FALSE,
                         deleted_at = NULL,
                         cancelled_at = NULL,
                         cancellation_reason = NULL,
                         updated_at = NOW(),
                         updated_by = $1
                     WHERE id = $2`,
                    [req.user.id, oldEnrollment.id]
                );
            }

            if (course.max_students != null) {
                const capacityResult = await client.query(
                    `SELECT COUNT(*)::int AS enrolled_count
                     FROM learning.enrollment
                     WHERE course_id = $1 AND soft_delete = FALSE
                       AND status IN ('ACTIVE', 'COMPLETED')`,
                    [courseId]
                );
                if (capacityResult.rows[0].enrolled_count >= Number(course.max_students)) {
                    throw couponError("Course enrollment limit reached.", 409);
                }
            }

            // Revalidate both codes inside the purchase transaction; never trust
            // client-side amounts.
            let couponQuote = null;
            const courseCouponCode = couponCodesByCourse
                ? couponCodesByCourse[String(courseId)] ?? null
                : couponCode;
            if (courseCouponCode && String(courseCouponCode).trim()) {
                couponQuote = await getCouponQuote(client, {
                    code: courseCouponCode,
                    student,
                    course,
                    price,
                    lockCoupon: true
                });
            } else {
                couponQuote = await getAutomaticCouponQuote(client, {
                    student,
                    course,
                    price,
                    lockCoupon: true
                });
            }
            const courseReferralCode = referralCodesByCourse
                ? referralCodesByCourse[String(courseId)] ?? null
                : referralCode;
            const referralQuote = courseReferralCode && String(courseReferralCode).trim()
                ? await getReferralQuote(client, { code: courseReferralCode, student, course, price })
                : await getStoredStudentReferralQuote(client, { student, course, price });
            const pricingQuote = combineDiscountQuotes({ price, couponQuote, referralQuote });

            const pendingEnrollment = await client.query(
                `SELECT id FROM learning.enrollment
                 WHERE student_id = $1 AND course_id = $2 AND soft_delete = FALSE
                   AND status = 'PENDING'
                 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
                [studentId, courseId]
            );

            let enrollmentId;
            if (pendingEnrollment.rowCount) {
                enrollmentId = pendingEnrollment.rows[0].id;
            } else {
                const enrollmentResult = await client.query(
                    `INSERT INTO learning.enrollment
                        (enrollment_number, student_id, course_id, enrollment_date,
                         status, created_by)
                     VALUES ($1, $2, $3, NOW(), 'PENDING', $4)
                     RETURNING id`,
                    [makeNumber("ENR"), studentId, courseId, req.user.id]
                );
                enrollmentId = enrollmentResult.rows[0].id;
            }

            await client.query(
                `UPDATE learning.enrollment
                 SET referred_by_instructor_id = $1,
                     referral_code_snapshot = $2,
                     referral_discount_percentage = $3,
                     referral_discount_amount = $4,
                     updated_at = NOW(), updated_by = $5
                 WHERE id = $6`,
                [referralQuote?.instructor_id ?? null, referralQuote?.referral_code ?? null,
                    pricingQuote.referral_discount_percentage.toFixed(2),
                    pricingQuote.referral_discount_amount.toFixed(2), req.user.id, enrollmentId]
            );

            let paymentResult = await client.query(
                `SELECT id, status FROM payment.payment
                 WHERE enrollment_id = $1 AND soft_delete = FALSE
                 LIMIT 1 FOR UPDATE`,
                [enrollmentId]
            );

            let paymentId;
            const currency = String(course.currency_code || "INR").toUpperCase();
            if (paymentResult.rowCount) {
                paymentId = paymentResult.rows[0].id;
                const oldStatus = paymentResult.rows[0].status;
                if (!['PENDING', 'FAILED', 'CANCELLED'].includes(oldStatus)) {
                    throw couponError("A payment already exists for this enrollment.", 409);
                }
                await client.query(
                    `UPDATE payment.payment
                     SET original_amount = $1, discount_amount = $2,
                         referral_discount_amount = $3, coupon_discount_amount = $4,
                         referral_incentive_amount = $5, tax_amount = 0,
                         final_amount = $6, paid_amount = 0, status = 'PENDING',
                         payment_method = 'DEMO', payment_gateway = 'DEMO',
                         gateway_order_id = NULL, payment_due_at = NULL,
                         paid_at = NULL, failed_at = NULL, failure_reason = NULL,
                         cancelled_at = NULL, cancellation_reason = NULL,
                         soft_delete = FALSE, updated_at = NOW(), updated_by = $7
                     WHERE id = $8`,
                    [pricingQuote.original_amount.toFixed(2), pricingQuote.discount_amount.toFixed(2),
                        pricingQuote.referral_discount_amount.toFixed(2),
                        pricingQuote.coupon_discount_amount.toFixed(2),
                        pricingQuote.referral_incentive_amount.toFixed(2),
                        pricingQuote.final_amount.toFixed(2), req.user.id, paymentId]
                );
            } else {
                const insertedPayment = await client.query(
                    `INSERT INTO payment.payment
                        (payment_number, enrollment_id, student_id, course_id, currency_code,
                         original_amount, discount_amount, referral_discount_amount,
                         coupon_discount_amount, referral_incentive_amount, tax_amount,
                         final_amount, paid_amount, status, payment_method, payment_gateway, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, 0,
                             'PENDING', 'DEMO', 'DEMO', $12)
                     RETURNING id`,
                    [makeNumber("PAY"), enrollmentId, studentId, courseId, currency,
                     pricingQuote.original_amount.toFixed(2), pricingQuote.discount_amount.toFixed(2),
                     pricingQuote.referral_discount_amount.toFixed(2),
                     pricingQuote.coupon_discount_amount.toFixed(2),
                     pricingQuote.referral_incentive_amount.toFixed(2),
                     pricingQuote.final_amount.toFixed(2), req.user.id]
                );
                paymentId = insertedPayment.rows[0].id;
            }

            // Record one successful simulated transaction for the final amount.
            await client.query(
                `INSERT INTO payment.payment_transaction
                    (payment_id, transaction_number, payment_gateway, payment_method,
                     transaction_type, amount, currency_code, status, gateway_status,
                     gateway_response_code, gateway_response_message, gateway_response,
                     processed_at, created_by)
                 VALUES ($1, $2, 'DEMO', 'DEMO', 'PAYMENT', $3, $4, 'SUCCESS',
                         'DEMO_COMPLETED', 'SIMULATED', 'Demo checkout completed; no money collected',
                         $5::jsonb, NOW(), $6)`,
                [paymentId, makeNumber("PTXN"), pricingQuote.final_amount.toFixed(2), currency,
                 JSON.stringify({ demo: true, amount: pricingQuote.final_amount, currency }), req.user.id]
            );

            // Mark the payment as paid only after its successful transaction is recorded.
            const paidPayment = await client.query(
                `UPDATE payment.payment
                 SET status = 'PAID',
                     paid_amount = final_amount,
                     paid_at = NOW(),
                     failed_at = NULL,
                     failure_reason = NULL,
                     updated_at = NOW(),
                     updated_by = $1
                 WHERE id = $2
                   AND status = 'PENDING'
                 RETURNING id`,
                [req.user.id, paymentId]
            );
            if (paidPayment.rowCount !== 1) {
                throw new Error("Successful transaction was recorded, but payment could not be marked paid.");
            }

            if (couponQuote?.id) {
                // Serialize coupon redemptions and re-check the usage limit after acquiring the lock.
                const lockedCoupon = await client.query(
                    `SELECT usage_limit, used_count FROM payment.coupon
                     WHERE id = $1 AND is_active = TRUE AND soft_delete = FALSE
                     FOR UPDATE`,
                    [couponQuote.id]
                );
                const reservedResult = lockedCoupon.rowCount && lockedCoupon.rows[0].usage_limit != null
                    ? await client.query(
                        `SELECT COUNT(*)::int AS reserved_count
                         FROM payment.coupon_redemption r
                         JOIN payment.payment p ON p.id = r.payment_id
                         WHERE r.coupon_id = $1
                           AND r.payment_id <> $2
                           AND r.status = 'RESERVED'
                           AND r.is_active = TRUE
                           AND r.soft_delete = FALSE
                           AND r.applied_at >= NOW() - INTERVAL '30 minutes'
                           AND p.status = 'PENDING'
                           AND p.soft_delete = FALSE`,
                        [couponQuote.id, paymentId]
                    )
                    : null;
                const reservedCount = Number(reservedResult?.rows[0]?.reserved_count || 0);
                if (!lockedCoupon.rowCount || (lockedCoupon.rows[0].usage_limit != null &&
                    Number(lockedCoupon.rows[0].used_count) + reservedCount >= Number(lockedCoupon.rows[0].usage_limit))) {
                    throw couponError("This coupon has reached its usage limit.", 409);
                }

                const registerSnapshot = String(student.register_number || student.student_code || "").trim();
                if (!registerSnapshot) throw couponError("Student register number is missing. Contact the administrator.", 400);

                const existingRedemption = await client.query(
                    `SELECT id, status, coupon_id FROM payment.coupon_redemption
                     WHERE payment_id = $1 LIMIT 1 FOR UPDATE`,
                    [paymentId]
                );
                if (existingRedemption.rowCount) {
                    const previousRedemption = existingRedemption.rows[0];
                    await client.query(
                        `UPDATE payment.coupon_redemption
                         SET coupon_id = $1, enrollment_id = $2, student_id = $3,
                             coupon_code_snapshot = $4, register_number_snapshot = $5,
                             original_amount = $6, discount_amount = $7, final_amount = $8,
                             status = 'REDEEMED', applied_at = NOW(), redeemed_at = NOW(),
                             cancelled_at = NULL, cancellation_reason = NULL,
                             is_active = TRUE, soft_delete = FALSE, updated_at = NOW(), updated_by = $9
                         WHERE id = $10`,
                        [couponQuote.id, enrollmentId, studentId, couponQuote.coupon_code, registerSnapshot,
                         couponQuote.original_amount.toFixed(2), couponQuote.discount_amount.toFixed(2),
                         couponQuote.final_amount.toFixed(2), req.user.id, existingRedemption.rows[0].id]
                    );
                    if (previousRedemption.status !== "REDEEMED" ||
                        String(previousRedemption.coupon_id) !== String(couponQuote.id)) {
                        await incrementCouponUsageForPaidPayment(
                            client,
                            couponQuote.id,
                            req.user.id
                        );
                    }
                } else {
                    await client.query(
                        `INSERT INTO payment.coupon_redemption
                            (coupon_id, payment_id, enrollment_id, student_id, coupon_code_snapshot,
                             register_number_snapshot, original_amount, discount_amount, final_amount,
                             status, applied_at, redeemed_at, created_by, is_active, soft_delete)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                                 'REDEEMED', NOW(), NOW(), $10, TRUE, FALSE)`,
                        [couponQuote.id, paymentId, enrollmentId, studentId, couponQuote.coupon_code,
                         registerSnapshot, couponQuote.original_amount.toFixed(2), couponQuote.discount_amount.toFixed(2),
                         couponQuote.final_amount.toFixed(2), req.user.id]
                    );
                    await incrementCouponUsageForPaidPayment(
                        client,
                        couponQuote.id,
                        req.user.id
                    );
                }
            } else {
                // If an earlier coupon reservation exists but this checkout has no coupon, cancel it.
                await client.query(
                    `UPDATE payment.coupon_redemption
                     SET status = 'CANCELLED', cancelled_at = NOW(),
                         cancellation_reason = 'Demo checkout completed without coupon',
                         is_active = FALSE, updated_at = NOW(), updated_by = $1
                     WHERE payment_id = $2 AND status = 'RESERVED' AND soft_delete = FALSE`,
                    [req.user.id, paymentId]
                );
            }

            const enrollmentUpdate = await client.query(
                `UPDATE learning.enrollment
                 SET status = 'ACTIVE',
                     start_date = COALESCE(start_date, CURRENT_DATE),
                     updated_at = NOW(), updated_by = $1
                 WHERE id = $2 AND student_id = $3 AND course_id = $4
                   AND status IN ('PENDING', 'ACTIVE') AND soft_delete = FALSE
                 RETURNING id`,
                [req.user.id, enrollmentId, studentId, courseId]
            );
            if (enrollmentUpdate.rowCount !== 1) {
                throw new Error("Payment was recorded, but enrollment activation failed.");
            }

            await recordReferralEarningForPaidEnrollment(client, paymentId, req.user.id);

            const courseCheckout = {
                course_id: courseId,
                enrollment_id: enrollmentId,
                payment_id: paymentId,
                enrollment_status: "ACTIVE",
                payment_status: "PAID",
                transaction_status: "SUCCESS",
                course_title: course.title,
                original_amount: pricingQuote.original_amount,
                discount_amount: pricingQuote.discount_amount,
                coupon_discount_amount: pricingQuote.coupon_discount_amount,
                referral_discount_amount: pricingQuote.referral_discount_amount,
                referral_discount_percentage: pricingQuote.referral_discount_percentage,
                final_amount: pricingQuote.final_amount,
                coupon_code: pricingQuote.coupon_code,
                referral_code: pricingQuote.referral_code,
                currency_code: currency
            };
            checkoutResults.push(courseCheckout);
            totalOriginalCents += Math.round(Number(pricingQuote.original_amount) * 100);
            totalDiscountCents += Math.round(Number(pricingQuote.discount_amount) * 100);
            totalFinalCents += Math.round(Number(pricingQuote.final_amount) * 100);
        }

        if (cartCheckout) {
            await client.query(
                `DELETE FROM learning.cart_item ci
                 USING learning.cart c
                 WHERE ci.cart_id = c.id
                   AND c.student_id = $1
                   AND c.status = 'ACTIVE'
                   AND c.soft_delete = FALSE
                   AND ci.course_id = ANY($2::int[])`,
                [studentId, courseIds]
            );
        }

        await client.query("COMMIT");

        for (const checkout of checkoutResults) {
            if (checkout.restored) continue;
            try {
                await notificationRepository.createForUser(
                    {
                        userId: req.user.id,
                        notificationType: "PAYMENT_SUCCESS",
                        title: "Enrollment confirmed",
                        message: `Your demo checkout for ${checkout.course_title} is complete. No real payment was collected.`,
                        preferenceKey: "payments",
                        createdBy: req.user.id
                    },
                    client
                );
            } catch (notificationError) {
                console.error(
                    "Failed to create the demo payment notification:",
                    notificationError
                );
            }
        }

        return res.status(200).json({
            success: true,
            demo: true,
            message: "Demo checkout completed successfully. No real payment was collected.",
            data: cartCheckout
                ? {
                    course_ids: courseIds,
                    courses: checkoutResults,
                    original_amount: totalOriginalCents / 100,
                    discount_amount: totalDiscountCents / 100,
                    final_amount: totalFinalCents / 100,
                    currency_code: [...currencies][0]
                }
                : checkoutResults[0]
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        return next(error);
    } finally {
        if (client) client.release();
    }
}


module.exports = {
    createOrder,
    verifyPayment,
    getAutomaticCoupon,
    applyCoupon,
    confirmDemoCheckout
};
