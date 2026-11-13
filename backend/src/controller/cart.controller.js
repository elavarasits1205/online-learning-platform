const cartService = require("../services/cart.service");


// ============================================================
// ADD COURSE TO CART
// ============================================================

async function addToCart(req, res, next) {
    try {
        const { course_id } = req.body;

        if (
            !course_id ||
            !Number.isSafeInteger(Number(course_id)) ||
            Number(course_id) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid course_id is required"
            });
        }

        const result = await cartService.addToCart(
            req.user.id,
            String(course_id)
        );

        return res.status(201).json({
            success: true,
            ...result
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        return next(error);
    }
}


// ============================================================
// GET MY CART
// ============================================================

async function getMyCart(req, res, next) {
    try {
        const cart = await cartService.getMyCart(
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: "Cart retrieved successfully",
            data: cart
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        return next(error);
    }
}


// ============================================================
// REMOVE COURSE FROM CART
// ============================================================

async function removeFromCart(req, res, next) {
    try {
        const { courseId } = req.params;

        if (
            !/^[1-9]\d*$/.test(String(courseId))
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid course ID is required"
            });
        }

        const result = await cartService.removeFromCart(
            req.user.id,
            courseId
        );

        return res.status(200).json({
            success: true,
            ...result
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        return next(error);
    }
}


module.exports = {
    addToCart,
    getMyCart,
    removeFromCart
};