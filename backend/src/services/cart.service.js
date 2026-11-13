const cartRepository = require("../repositories/cart.repository");


// ============================================================
// GET STUDENT ID
// ============================================================

async function getStudentId(userId) {

    const student =
        await cartRepository.findStudentByUserId(userId);

    if (!student) {
        const error = new Error(
            "Active student profile not found"
        );

        error.statusCode = 403;
        throw error;
    }

    return student.id;
}


// ============================================================
// ADD COURSE TO CART
// ============================================================

async function addToCart(userId, courseId) {

    const studentId = await getStudentId(userId);

    // Check course availability
    const course =
        await cartRepository.findPurchasableCourse(courseId);

    if (!course) {
        const error = new Error(
            "Published paid course not found"
        );

        error.statusCode = 404;
        throw error;
    }

    // Check existing enrollment
    const alreadyEnrolled =
        await cartRepository.isStudentEnrolled(
            studentId,
            courseId
        );

    if (alreadyEnrolled) {
        const error = new Error(
            "You are already enrolled in this course"
        );

        error.statusCode = 409;
        throw error;
    }

    // Get or create active cart
    const cart =
        await cartRepository.getOrCreateActiveCart(studentId);

    if (!cart) {
        throw new Error("Unable to create student cart");
    }

    // Add course
    const item =
        await cartRepository.addCartItem(
            cart.id,
            courseId
        );

    if (!item) {
        const error = new Error(
            "Course is already in your cart"
        );

        error.statusCode = 409;
        throw error;
    }

    return {
        message: "Course added to cart successfully",
        cart_id: cart.id,
        item
    };
}


// ============================================================
// GET STUDENT CART
// ============================================================

async function getMyCart(userId) {

    const studentId = await getStudentId(userId);

    // Ensure active cart exists
    await cartRepository.getOrCreateActiveCart(studentId);

    const cart =
        await cartRepository.getCartDetails(studentId);

    return cart;
}


// ============================================================
// REMOVE COURSE FROM CART
// ============================================================

async function removeFromCart(userId, courseId) {

    const studentId = await getStudentId(userId);

    const cart =
        await cartRepository.getOrCreateActiveCart(studentId);

    if (!cart) {
        const error = new Error("Cart not found");
        error.statusCode = 404;
        throw error;
    }

    const removed =
        await cartRepository.removeCartItem(
            cart.id,
            courseId
        );

    if (!removed) {
        const error = new Error(
            "Course not found in your cart"
        );

        error.statusCode = 404;
        throw error;
    }

    return {
        message: "Course removed from cart successfully"
    };
}


module.exports = {
    addToCart,
    getMyCart,
    removeFromCart
};