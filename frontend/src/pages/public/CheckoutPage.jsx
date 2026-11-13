import { useEffect, useMemo, useState } from "react";

import {

  Link as RouterLink,

  useNavigate,

  useParams,

}from "react-router-dom";

import {

  Alert,

  Box,

  Button,

  CircularProgress,

  Container,

  Divider,

  Paper,

  Stack,

  TextField,

  Typography,

} from "@mui/material";



import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";



import api from "../../service/Api";

import "./CheckoutPage.scss";



function getPayload(response) {

  return response?.data?.data ?? response?.data ?? {};

}



function isFreeCourse(course) {

  return String(course?.course_type || "").toUpperCase() === "FREE";

}



function getCurrency(course) {

  return String(course?.currency_code || "INR").toUpperCase();

}



function formatMoney(amount, currency = "INR") {

  const value = Number(amount);



  if (!Number.isFinite(value)) return "Price unavailable";



  try {

    return new Intl.NumberFormat("en-IN", {

      style: "currency",

      currency,

      maximumFractionDigits: 2,

    }).format(value);

  } catch {

    return `${currency} ${value.toFixed(2)}`;

  }

}



function moneyToCents(amount) {

  const value = Number(amount);

  return Number.isFinite(value)

    ? Math.round((value + Number.EPSILON) * 100)

    : 0;

}



export default function CheckoutPage() {

  const { courseId } = useParams();

  const navigate = useNavigate();

  const cartCheckout = !courseId;



  const [courses, setCourses] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");



  const [discountInputs, setDiscountInputs] = useState({});

  const [appliedDiscounts, setAppliedDiscounts] = useState({});

  const [automaticCouponByCourse, setAutomaticCouponByCourse] = useState({});

  const [referralStatusByCourse, setReferralStatusByCourse] = useState({});

  const [applyingCourseId, setApplyingCourseId] = useState(null);

  const [loadingAutomaticCoupon, setLoadingAutomaticCoupon] = useState(false);

  const [discountMessages, setDiscountMessages] = useState({});

  const [discountErrors, setDiscountErrors] = useState({});



  const [buying, setBuying] = useState(false);

  const [purchaseError, setPurchaseError] = useState("");



  useEffect(() => {

    const controller = new AbortController();



    async function loadCheckoutCourses() {

      setLoading(true);

      setError("");

      setDiscountInputs({});

      setAppliedDiscounts({});

      setAutomaticCouponByCourse({});

      setReferralStatusByCourse({});

      setDiscountErrors({});

      setDiscountMessages({});

      setLoadingAutomaticCoupon(false);



      try {

        if (cartCheckout) {

          const response = await api.get("/student/cart", {

            signal: controller.signal,

          });

          const cart = getPayload(response);

          const items = Array.isArray(cart?.items) ? cart.items : [];

          const selectedCourses = items

            .filter((item) => item?.course_id)

            .map((item) => ({

              id: item.course_id,

              title: item.title,

              thumbnail_url: item.thumbnail_url,

              price: item.price,

              currency_code: item.currency_code,

              level: item.level,

              course_type: "PAID",

            }));



          if (!selectedCourses.length) {

            throw new Error("Your cart is empty. Add a course before checkout.");

          }



          setCourses(selectedCourses);

        } else {

          const response = await api.get(

            `/public/courses/${encodeURIComponent(courseId)}`,

            { signal: controller.signal }

          );

          const payload = getPayload(response);

          const selectedCourse = payload.course ?? payload;



          if (!selectedCourse?.id) {

            throw new Error("Course details are unavailable.");

          }



          setCourses([selectedCourse]);

        }

      } catch (err) {

        if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") {

          setError(

            err?.response?.data?.message || err.message ||

              "Unable to load checkout details."

          );

        }

      } finally {

        if (!controller.signal.aborted) setLoading(false);

      }

    }



    loadCheckoutCourses();

    return () => controller.abort();

  }, [cartCheckout, courseId]);



  const subtotal = useMemo(

    () => courses.reduce((total, course) => total + moneyToCents(course.price), 0) / 100,

    [courses]

  );

  const currency = getCurrency(courses[0]);

  const sameCurrency = courses.every((course) => getCurrency(course) === currency);

  const validPrice = courses.length > 0 && sameCurrency && courses.every((course) => {

    const price = Number(course.price);

    return String(course.course_type || "PAID").toUpperCase() === "PAID" &&

      Number.isFinite(price) && price > 0;

  });


  const discountAmount = Object.values(appliedDiscounts).reduce(

    (total, quote) => total + Number(quote.discount_amount || 0),

    0

  );

  const finalAmount = Math.max(0, subtotal - discountAmount);




  useEffect(() => {

    const eligibleCourses = courses.filter((course) => !isFreeCourse(course));

    if (!eligibleCourses.length) {

      return undefined;

    }



    const controller = new AbortController();



    async function loadAutomaticCoupons() {

      await Promise.resolve();

      if (controller.signal.aborted) return;

      setLoadingAutomaticCoupon(true);



      const results = await Promise.all(eligibleCourses.map(async (course) => {

        try {

          const response = await api.get("/student/payments/automatic-coupon", {

            params: { course_id: course.id },

            signal: controller.signal,

          });


          return { course, response, quote: response.data?.data };

        } catch (error) {

          return { course, error };

        }

      }));



      if (controller.signal.aborted) return;



      const couponInputs = {};

      const automaticCoupons = {};

      const referralStatuses = {};

      const quotes = {};

      const messages = {};

      const errors = {};



      results.forEach(({ course, response, quote, error }) => {

        const key = String(course.id);

        if (error) {

          errors[key] = error?.response?.data?.message ||

            "Automatic coupon lookup failed. You can enter a code manually.";

          return;

        }



        const referralStatus = response?.data?.referral ?? null;

        if (referralStatus && typeof referralStatus.available === "boolean") {

          referralStatuses[key] = referralStatus;

        }



        if (!quote?.coupon_code) {

          messages[key] = response?.data?.message ||

            "No institution coupon is available for this course.";

          return;

        }



        const price = Number(course.price);

        const discount = Number(quote.discount_amount);

        const total = Number(quote.final_amount);

        if (!Number.isFinite(discount) || !Number.isFinite(total) ||

            discount < 0 || discount > price || total < 0 ||

            Math.abs(price - discount - total) > 0.02) {

          errors[key] = "The server returned invalid automatic coupon pricing.";

          return;

        }



        couponInputs[key] = quote.coupon_code;

        automaticCoupons[key] = quote.coupon_code;

        quotes[key] = {

          coupon_code: quote.coupon_code,

          referral_code: null,

          coupon_discount_amount: discount,

          referral_discount_amount: 0,

          referral_discount_percentage: 0,

          discount_amount: discount,

          final_amount: total,

        };

        messages[key] = `Institution coupon ${quote.coupon_code} applied automatically.`;

      });



      setDiscountInputs((current) => {

        const next = { ...current };

        Object.entries(couponInputs).forEach(([key, coupon_code]) => {

          next[key] = { ...(next[key] || {}), coupon_code };

        });

        return next;

      });

      setAutomaticCouponByCourse(automaticCoupons);

      setReferralStatusByCourse(referralStatuses);

      setAppliedDiscounts((current) => ({ ...current, ...quotes }));

      setDiscountMessages((current) => ({ ...current, ...messages }));

      setDiscountErrors((current) => ({ ...current, ...errors }));

      setLoadingAutomaticCoupon(false);

    }



    loadAutomaticCoupons();

    return () => controller.abort();

  }, [courses]);



  function handleDiscountInputChange(courseId, field, value) {

    const key = String(courseId);

    setDiscountInputs((current) => ({

      ...current,

      [key]: { ...(current[key] || {}), [field]: value },

    }));

    if (field === "coupon_code") {

      setAutomaticCouponByCourse((current) => {

        const next = { ...current };

        delete next[key];

        return next;

      });

    }

    if (field === "referral_code") {

      setAppliedDiscounts((current) => {

        const quote = current[key];

        if (!quote?.referral_code) return current;



        const course = courses.find((item) => String(item.id) === key);

        const originalAmount = Number(course?.price || quote.original_amount || 0);

        const couponDiscount = Number(quote.coupon_discount_amount || 0);

        return {

          ...current,

          [key]: {

            ...quote,

            referral_code: null,

            referral_discount_amount: 0,

            referral_discount_percentage: 0,

            discount_amount: couponDiscount,

            final_amount: Math.max(0, Math.round((originalAmount - couponDiscount + Number.EPSILON) * 100) / 100),

          },

        };

      });

    } else {

      setAppliedDiscounts((current) => {

        const next = { ...current };

        delete next[key];

        return next;

      });

    }

    setDiscountMessages((current) => ({ ...current, [key]: "" }));

    setDiscountErrors((current) => ({ ...current, [key]: "" }));

    setPurchaseError("");

  }



  async function handleApplyDiscounts(course) {

    const key = String(course.id);

    const input = discountInputs[key] || {};

    const coupon = String(input.coupon_code || "").trim();

    const referral = String(input.referral_code || "").trim();

    if (!coupon && !referral) {

      setDiscountErrors((current) => ({ ...current, [key]: "Enter a coupon or instructor referral code." }));

      return;

    }

    if (!validPrice) {

      setDiscountErrors((current) => ({ ...current, [key]: "Course prices are unavailable." }));

      return;

    }



    setApplyingCourseId(key);

    setDiscountErrors((current) => ({ ...current, [key]: "" }));

    setDiscountMessages((current) => ({ ...current, [key]: "" }));

    setPurchaseError("");



    try {

      const response = await api.post("/student/payments/apply-coupon", {

        course_id: Number(course.id),

        ...(coupon ? { coupon_code: coupon } : {}),

        ...(referral ? { referral_code: referral } : {}),

      });

      const result = getPayload(response);

      const price = Number(course.price);

      const discount = Number(result.discount_amount);

      const total = Number(result.final_amount);

      if (result.success === false || !Number.isFinite(discount) ||

          !Number.isFinite(total) || discount < 0 || discount > price || total < 0 ||

          Math.abs(price - discount - total) > 0.02) {

        throw new Error(result.message || "The server returned invalid discount pricing.");

      }

      setAppliedDiscounts((current) => ({

        ...current,

        [key]: {

          coupon_code: result.coupon_code || null,

          referral_code: result.referral_code || null,

          coupon_discount_amount: Number(result.coupon_discount_amount || 0),

          referral_discount_amount: Number(result.referral_discount_amount || 0),

          referral_discount_percentage: Number(result.referral_discount_percentage || 0),

          discount_amount: discount,

          final_amount: total,

        },

      }));

      setDiscountMessages((current) => ({

        ...current,

        [key]: result.referral_discount_exhausted

          ? "Referral code recorded for your instructor, but your referral discount was already used on a previous enrollment."

          : "Discounts applied to this enrollment.",

      }));


    } catch (err) {

      setDiscountErrors((current) => ({

        ...current,

        [key]: err?.response?.data?.message || err.message || "Unable to apply discounts. Please try again.",

      }));

    } finally {

      setApplyingCourseId(null);

    }

  }



  async function handleBuyNow() {

    if (buying || !courses.length || !validPrice) return;



    const unappliedCode = courses.some((course) => {

      const key = String(course.id);

      const input = discountInputs[key] || {};

      const referralCode = String(input.referral_code || "").trim().toUpperCase();

      const appliedReferralCode = String(appliedDiscounts[key]?.referral_code || "").trim().toUpperCase();

      return referralCode !== appliedReferralCode;

    });

    if (unappliedCode) {

      setPurchaseError("Apply or clear each entered code before confirming checkout.");

      return;

    }



    const couponCodesByCourse = Object.fromEntries(

      Object.entries(appliedDiscounts)

        .filter(([, quote]) => quote.coupon_code)

        .map(([id, quote]) => [id, quote.coupon_code])

    );

    const referralCodesByCourse = Object.fromEntries(

      Object.entries(appliedDiscounts)

        .filter(([, quote]) => quote.referral_code)

        .map(([id, quote]) => [id, quote.referral_code])

    );



    setBuying(true);

    setPurchaseError("");



    try {

      const response = await api.post("/student/payments/demo-checkout", {

        ...(cartCheckout

          ? { course_ids: courses.map((course) => Number(course.id)) }

          : { course_id: Number(courses[0].id) }),

        ...(Object.keys(couponCodesByCourse).length

          ? { coupon_codes_by_course: couponCodesByCourse }

          : {}),

        ...(Object.keys(referralCodesByCourse).length

          ? { referral_codes_by_course: referralCodesByCourse }

          : {}),

      });

      const result = getPayload(response);



      if (response?.data?.success === false || result.success === false) {

        throw new Error(result.message || "Purchase could not be completed.");

      }



      if (!cartCheckout && result.already_enrolled) {

        navigate(`/student/learning/${encodeURIComponent(courses[0].id)}`, {

          replace: true,

        });

        return;

      }



      navigate("/student/my-learning", {

        replace: true,

        state: {

          purchaseSuccess: true,

          purchaseMessage: result.message ||

            "Your demo purchase was successful. Your courses are ready in My Learning.",

          purchasedCourseCount: courses.length,

        },

      });

    } catch (err) {

      if (err?.response?.status === 401 || err?.statusCode === 401) {

        const returnTo = cartCheckout ? "/checkout" : `/checkout/${courseId}`;

        navigate(`/login?redirect=${encodeURIComponent(returnTo)}`);

        return;

      }



      setPurchaseError(

        err?.response?.data?.message || err.message ||

          "Purchase failed. Please try again."

      );

    } finally {

      setBuying(false);

    }

  }



  if (loading) {

    return (

      <Box className="checkout-state">

        <CircularProgress />

        <Typography>Loading checkout...</Typography>

      </Box>

    );

  }



  if (error || !courses.length) {

    return (

      <Container maxWidth="md" sx={{ py: 6 }}>

        <Alert severity={error?.includes("cart is empty") ? "info" : "error"}>

          {error || "Course details are unavailable."}

        </Alert>

        <Button

          component={RouterLink}

          to={cartCheckout ? "/student/cart" : "/"}

          sx={{ mt: 2 }}

          startIcon={<ArrowBackRoundedIcon />}

        >

          {cartCheckout ? "Back to cart" : "Explore courses"}

        </Button>

      </Container>

    );

  }



  if (!cartCheckout && courses.length === 1 && isFreeCourse(courses[0])) {

    return (

      <Container maxWidth="sm" sx={{ py: 6 }}>

        <Alert severity="info">

          This is a free course. Please enroll directly from the course details page.

        </Alert>

        <Button variant="contained" sx={{ mt: 2 }}

          onClick={() => navigate(`/courses/${courses[0].id}`)}>

          Go to course

        </Button>

      </Container>

    );

  }



  if (!cartCheckout && courses[0].is_enrolled) {

    return (

      <Container maxWidth="sm" sx={{ py: 6 }}>

        <Alert severity="success">You are already enrolled in this course.</Alert>

        <Button variant="contained" sx={{ mt: 2 }}

          onClick={() => navigate(`/student/learning/${encodeURIComponent(courses[0].id)}`)}>

          Go to My Learning

        </Button>

      </Container>

    );

  }



  return (

    <main className="checkout-page">

      <Container maxWidth="lg">

        <Button

          component={RouterLink}

          to={cartCheckout ? "/student/cart" : `/courses/${courses[0].id}`}

          startIcon={<ArrowBackRoundedIcon />}

          className="checkout-back"

        >

          {cartCheckout ? "Back to cart" : "Back to course"}

        </Button>



        <Box className="checkout-heading">

          <Typography component="h1">Checkout</Typography>

          <Typography>

            Review {courses.length === 1 ? "your course" : `all ${courses.length} courses`} before confirming your demo purchase.

          </Typography>

        </Box>



        <Box className="checkout-layout">

          <Paper elevation={0} className="checkout-course checkout-course-list">

            <Typography className="checkout-label">

              {courses.length === 1 ? "YOUR COURSE" : "YOUR COURSES"}

            </Typography>



            <Stack spacing={2}>

              {courses.map((course) => {


                const courseKey = String(course.id);

                const discountInput = discountInputs[courseKey] || {};

                const appliedQuote = appliedDiscounts[courseKey];

                const referralInput = String(discountInput.referral_code || "").trim().toUpperCase();

                const appliedReferral = String(appliedQuote?.referral_code || "").trim().toUpperCase();

                const appliedCoupon = String(appliedQuote?.coupon_code || "").trim().toUpperCase();

                const automaticCoupon = String(automaticCouponByCourse[courseKey] || "").trim().toUpperCase();

                const referralStatus = referralStatusByCourse[courseKey];

                const referralUnavailable = referralStatus?.available === false;

                const discountsApplied = Boolean(appliedQuote) &&

                  referralInput === appliedReferral && appliedCoupon === automaticCoupon;



                return (

                <Box className="checkout-course-item" key={course.id}>

                  {course.thumbnail_url ? (

                    <img

                      className="checkout-course__image"

                      src={course.thumbnail_url}

                      alt={course.title}

                    />

                  ) : (

                    <Box className="checkout-course__placeholder">

                      <SchoolOutlinedIcon />

                    </Box>

                  )}

                  <Box className="checkout-course-item__details">

                    <Typography component="h2">{course.title}</Typography>

                    {(course.short_description || course.description) && (

                      <Typography className="checkout-description">

                        {course.short_description || course.description}

                      </Typography>

                    )}

                    {course.level && (

                      <Typography className="checkout-level">Level: {course.level}</Typography>

                    )}

                    <Stack spacing={1} sx={{ mt: 1.5 }}>

                      <TextField

                        size="small"

                        label="Institution coupon"

                        placeholder="Applied automatically when available"

                        value={discountInput.coupon_code || ""}

                        disabled={Boolean(applyingCourseId) || loadingAutomaticCoupon || buying}

                        inputProps={{ maxLength: 50, readOnly: true }}

                      />

                      <TextField

                        size="small"

                        label="Instructor referral code"

                        placeholder={referralUnavailable

                          ? "Referral discount already used"

                          : "Enter a code if you were referred by an instructor"}

                        value={discountInput.referral_code || ""}

                        onChange={(event) => handleDiscountInputChange(course.id, "referral_code", event.target.value)}

                        disabled={Boolean(applyingCourseId) || loadingAutomaticCoupon || buying || referralUnavailable}

                        inputProps={{ maxLength: 30 }}

                      />

                      <Button

                        variant="outlined"

                        onClick={() => handleApplyDiscounts(course)}

                        disabled={Boolean(applyingCourseId) || loadingAutomaticCoupon || buying ||

                          !referralInput || discountsApplied || referralUnavailable}

                        sx={{ alignSelf: "flex-start" }}

                      >

                        {applyingCourseId === courseKey

                          ? <CircularProgress size={20} />

                          : discountsApplied

                            ? "Discounts applied"

                            : "Apply referral code"}

                      </Button>

                      {referralUnavailable && (

                        <Alert severity="info">

                          {referralStatus.message ||

                            "Your instructor referral discount has already been used on a previous enrollment."}

                        </Alert>

                      )}

                      {discountErrors[courseKey] && (

                        <Alert severity="error">{discountErrors[courseKey]}</Alert>

                      )}

                      {discountMessages[courseKey] && (

                        <Alert severity={appliedQuote ? "success" : "info"}>

                          {discountMessages[courseKey]}

                        </Alert>

                      )}

                    </Stack>

                    <Stack direction="row" justifyContent="space-between" gap={2}>

                      <Typography>Course price</Typography>

                      <Typography fontWeight={600} whiteSpace="nowrap">

                        {formatMoney(course.price, getCurrency(course))}

                      </Typography>

                    </Stack>

                  </Box>

                </Box>


                );

              })}

            </Stack>

          </Paper>



          <Paper elevation={0} className="checkout-summary">

            <Typography component="h2">Order summary</Typography>



            <Stack spacing={1.5} sx={{ mt: 2 }}>

              {courses.map((course) => {

                const quote = appliedDiscounts[String(course.id)] || null;

                return (

                  <Stack key={course.id} direction="row" justifyContent="space-between" gap={2}>

                    <Typography>{course.title}</Typography>

                    {quote ? (

                      <Stack alignItems="flex-end" spacing={0.25}>

                        <Typography variant="caption" color="text.secondary" sx={{ textDecoration: "line-through" }}>

                          {formatMoney(quote.original_amount, getCurrency(course))}

                        </Typography>

                        <Typography variant="caption" color="success.main">

                          −{formatMoney(quote.discount_amount, getCurrency(course))}

                        </Typography>

                        <Typography fontWeight={700} whiteSpace="nowrap">

                          {formatMoney(quote.final_amount, getCurrency(course))}

                        </Typography>

                      </Stack>

                    ) : (

                      <Typography fontWeight={600} whiteSpace="nowrap">

                        {formatMoney(course.price, getCurrency(course))}

                      </Typography>

                    )}

                  </Stack>

                );

              })}

              <Divider />

              <Stack direction="row" justifyContent="space-between" gap={2}>

                <Typography color="text.secondary">Subtotal</Typography>

                <Typography>{formatMoney(subtotal, currency)}</Typography>

              </Stack>

            </Stack>



            <Divider sx={{ my: 2 }} />




            <Divider sx={{ my: 2 }} />



            <Stack spacing={1.5}>

              {courses.map((course) => {

                const quote = appliedDiscounts[String(course.id)];

                if (!quote) return null;

                return (

                  <Box key={`discount-${course.id}`}>

                    {quote.coupon_code && (

                      <Stack direction="row" justifyContent="space-between" gap={2}>

                        <Typography color="success.main">Coupon ({quote.coupon_code}) · {course.title}</Typography>

                        <Typography color="success.main" fontWeight={600}>

                          −{formatMoney(quote.coupon_discount_amount, getCurrency(course))}

                        </Typography>

                      </Stack>

                    )}

                    {quote.referral_code && Number(quote.referral_discount_amount) > 0 && (

                      <Stack direction="row" justifyContent="space-between" gap={2}>

                        <Typography color="success.main">Referral ({quote.referral_code}{Number(quote.referral_discount_percentage || 0) > 0 ? ` · ${quote.referral_discount_percentage}%` : ""}) · {course.title}</Typography>

                        <Typography color="success.main" fontWeight={600}>

                          −{formatMoney(quote.referral_discount_amount, getCurrency(course))}

                        </Typography>

                      </Stack>

                    )}

                  </Box>

                );

              })}

              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>

                <Typography fontWeight={700}>Total</Typography>

                <Typography fontWeight={700} fontSize="1.2rem">

                  {validPrice ? formatMoney(finalAmount, currency) : "Price unavailable"}

                </Typography>

              </Stack>

            </Stack>



            {!sameCurrency && (

              <Alert severity="error" sx={{ mt: 2 }}>

                All courses in one checkout must use the same currency. Remove courses with a different currency from your cart.

              </Alert>

            )}

            {purchaseError && <Alert severity="error" sx={{ mt: 2 }}>{purchaseError}</Alert>}



            <Button

              fullWidth

              variant="contained"

              onClick={handleBuyNow}

              disabled={buying || !validPrice}

              startIcon={buying

                ? <CircularProgress size={18} color="inherit" />

                : <LockOutlinedIcon />}

              sx={{ mt: 3, py: 1.4 }}

            >

              {buying ? "Processing..." : courses.length > 1 ? "Confirm Purchase" : "Buy Now"}

            </Button>



            <Typography className="checkout-secure-note">

              Demo checkout only. No real payment will be collected.

            </Typography>

          </Paper>

        </Box>

      </Container>

    </main>

  );

}