import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Public pages
const LandingPage = lazy(() => import("../pages/public/LandingPage"));
const CourseDetails = lazy(() => import("../pages/public/CourseDetails"));
const CheckoutPage = lazy(() => import("../pages/public/CheckoutPage"));
const LoginPage = lazy(() => import("../pages/public/LoginPage"));
const ForgotPasswordPage = lazy(() => import("../pages/public/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("../pages/public/ResetPasswordPage"));
const CertificateVerification = lazy(() => import("../pages/public/CertificateVerification"));

// Registration
const StudentRegisterPage = lazy(() => import("../pages/auth/StudentRegisterPage"));
const InstructorRegisterPage = lazy(() => import("../pages/auth/InstructorRegisterPage"));

// Admin pages
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminCoursePage = lazy(() => import("../pages/admin/admin-course"));
const CourseCategoryPage = lazy(() => import("../pages/admin/CourseCategoryPage"));
const RoleManagementPage = lazy(() => import("../pages/admin/RoleManagementPage"));
const UserManagement = lazy(() => import("../pages/admin/UserManagement"));
const PermissionManagementPage = lazy(() => import("../pages/admin/settings/PermissionManagementPage"));
const RoleMenuPrivilegesPage = lazy(() => import("../pages/admin/settings/RoleMenuPrivilegesPage"));
const InstitutionPage = lazy(() => import("../pages/admin/master-data/InstitutionPage"));
const CouponPage = lazy(() => import("../pages/admin/CouponPage"));
const CouponCoursePage = lazy(() => import("../pages/admin/coupon/CouponCoursePage"));
const CouponStudentPage = lazy(() => import("../pages/admin/coupon/CouponStudentPage"));
const CouponRedemptionPage = lazy(() => import("../pages/admin/coupon/CouponRedemptionPage"));
const StudentAdmin = lazy(() => import("../pages/admin/StudentAdmin"));
const InstructorAdmin = lazy(() => import("../pages/admin/InstructorAdmin"));
const AdminProfilePage = lazy(() => import("../pages/admin/Profile"));
const AdminEnrollmentsPage = lazy(() => import("../pages/admin/enrollments/AdminEnrollmentsPage"));
const ReportedDiscussionsPage = lazy(() => import("../pages/Community/ReportedDiscussionsPage"));

const AdminPaymentsPage = lazy(() => import("../pages/admin/payments/AdminPaymentTables").then((module) => ({ default: module.AdminPaymentsPage })));
const AdminPaymentReportPage = lazy(() => import("../pages/admin/payments/AdminPaymentTables").then((module) => ({ default: module.AdminPaymentReportPage })));
const AdminTransactionsPage = lazy(() => import("../pages/admin/payments/AdminPaymentTables").then((module) => ({ default: module.AdminTransactionsPage })));
const AdminRefundsPage = lazy(() => import("../pages/admin/payments/AdminPaymentTables").then((module) => ({ default: module.AdminRefundsPage })));
const AdminWebhooksPage = lazy(() => import("../pages/admin/payments/AdminPaymentTables").then((module) => ({ default: module.AdminWebhooksPage })));

const CompensationManagement = lazy(() => import("../pages/admin/payroll/CompensationManagement"));
const ReferralMaster = lazy(() => import("../pages/admin/payroll/ReferralMaster"));
const PayrollPeriods = lazy(() => import("../pages/admin/payroll/PayrollPeriods"));
const AdminInstructorPayrollPage = lazy(() => import("../pages/admin/payroll/InstructorPayroll"));
const CourseEarnings = lazy(() => import("../pages/admin/payroll/CourseEarnings"));
const PaymentManagement = lazy(() => import("../pages/admin/payroll/PaymentManagement"));
const PayrollReportsPage = lazy(() => import("../pages/admin/payroll/PayrollData"));
const PayrollReportPage = lazy(() => import("../pages/admin/reports/PayrollReportPage"));
const EnrollmentReportPage = lazy(() => import("../pages/admin/reports/EnrollmentReportPage"));
const UserReportPage = lazy(() => import("../pages/admin/reports/UserReportPage"));

// Student pages
const StudentDashboard = lazy(() => import("../pages/Student/StudentDashboard/StudentDashboard"));
const CourseSearchResults = lazy(() => import("../pages/Student/CourseSearchResults/CourseSearchResults"));
const StudentProfilePage = lazy(() => import("../pages/Student/StudentProfilePage"));
const StudentCart = lazy(() => import("../pages/Student/StudentDashboard/StudentCart"));
const WishlistPage = lazy(() => import("../pages/Student/WishlistPage"));
const MyLearning = lazy(() => import("../pages/Student/My Learning/MyLearning"));
const CompletedCoursesPage = lazy(() => import("../pages/Student/CompletedCoursePage"));
const PurchaseHistory = lazy(() => import("../pages/Student/PurchaseHistory/PurchaseHistory"));
const CourseLearningPage = lazy(() => import("../pages/Student/CourseLearningPage/CourseLearningPage"));
const AssessmentPage = lazy(() => import("../pages/Student/AssessmentPage/AssessmentPage"));
const StudentAssessmentPage = lazy(() => import("../pages/Student/StudentAssessment/StudentAssessmentPage"));
const StudentAssessmentDetailsPage = lazy(() => import("../pages/Student/StudentAssessment/StudentAssessmentDetailsPage"));
const TakeAssessmentPage = lazy(() => import("../pages/Student/StudentAssessment/TakeAssessmentPage"));
const StudentAssessmentResultPage = lazy(() => import("../pages/Student/StudentAssessment/StudentAssessmentResultPage"));

// Instructor pages
const InstructorDashboard = lazy(() => import("../pages/Instructor/dashboard/InstructorDashboard"));
const InstructorEnrollmentReportPage = lazy(() => import("../pages/Instructor/dashboard/InstructorEnrollmentReportPage"));
const MyCoursesPage = lazy(() => import("../pages/Instructor/course/MyCoursesPage"));
const CreateCoursePage = lazy(() => import("../pages/Instructor/course/CreateCoursePage"));
const EditCoursePage = lazy(() => import("../pages/Instructor/course/EditCoursePage"));
const CourseCurriculumPage = lazy(() => import("../pages/Instructor/course/CourseCurriculumPage"));
const InstructorProfilePage = lazy(() => import("../pages/Instructor/InstructorProfile"));
const AllCoursesPage = lazy(() => import("../pages/Instructor/course/AllCoursesPage"));
const ViewCoursePage = lazy(() => import("../pages/Instructor/course/ViewCoursePage"));
const CourseCategoriesPage = lazy(() => import("../pages/Instructor/course/CourseCategoriesPage"));
const AssessmentManagePage = lazy(() => import("../pages/Instructor/Assessment/AssessmentManagePage"));
const AssessmentResultsPage = lazy(() => import("../pages/Instructor/Assessment/AssessmentResultPage"));
const AssessmentAttemptReviewPage = lazy(() => import("../pages/Instructor/Assessment/AssessmentAttemptReviewPage"));
const InstructorAssessmentsPage = lazy(() => import("../pages/Instructor/Assessment/InstructorAssessmentPage"));
const InstructorQuestionBankPage = lazy(() => import("../pages/Instructor/Assessment/InstructorQuestionBankPage"));
const InstructorEarningsOverviewPage = lazy(() => import("../pages/Instructor/payroll/EarningsOverview"));
const InstructorCourseWiseEarningsPage = lazy(() => import("../pages/Instructor/payroll/CourseWiseEarnings"));
const InstructorPayrollHistoryPage = lazy(() => import("../pages/Instructor/payroll/PayrollHistory"));
const InstructorPaymentHistoryPage = lazy(() => import("../pages/Instructor/payroll/LogPayData"));
const InstructorPayslipPage = lazy(() => import("../pages/Instructor/payroll/DownloadPayslip"));

// Community pages
const CommunityPage = lazy(() => import("../pages/Community/CommunityPage"));
const PostDetailsPage = lazy(() => import("../pages/Community/PostDetailsPage"));
const NotificationsPage = lazy(() => import("../pages/Community/NotificationsPage"));

// Route protection and layout
import PrivateRoute from "./PrivateRoute";
import RoleRouter from "./RoleRouter";
import PermissionRoute from "./PermissionRoute";
import AppLayout from "../layouts/AppLayout";

const USER_MANAGEMENT_ROLES = ["ADMIN"];
const USER_MANAGEMENT_PERMISSIONS = [
  "USER_MANAGEMENT_VIEW",
  "USER_VIEW",
  "USER_CREATE",
  "USER_UPDATE",
  "USER_DELETE",
];
const COMPENSATION_PERMISSIONS = [
  "PAYROLL_COMPENSATION_VIEW",
  "PAYROLL_COMPENSATION_CREATE",
  "PAYROLL_COMPENSATION_UPDATE",
  "PAYROLL_COMPENSATION_DELETE",
];

export default function AppRouter() {
  return (
    <Suspense fallback={<div className="olp-route-loading" role="status">Loading page…</div>}>
      <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/courses" element={<CourseSearchResults />} />
      <Route path="/courses/:courseId" element={<CourseDetails />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/register/student" element={<StudentRegisterPage />} />
      <Route path="/register/instructor" element={<InstructorRegisterPage />} />
      <Route
        path="/verify-certificate"
        element={<CertificateVerification />}
      />

      {/* Protected routes */}
      <Route element={<PrivateRoute />}>
        {/* Student-only pages that do not use the main sidebar layout */}
        <Route element={<RoleRouter allowedRoles={["STUDENT"]} />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/search" element={<CourseSearchResults />} />
          <Route path="/student/profile" element={<StudentProfilePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/checkout/:courseId" element={<CheckoutPage />} />
          <Route path="/student/cart" element={<StudentCart />} />
          <Route path="/student/wishlist" element={<WishlistPage />} />
          <Route path="/student/my-learning" element={<MyLearning />} />
          <Route path="/student/learning-courses" element={<MyLearning />} />
          <Route path="/student/completed-courses" element={<CompletedCoursesPage />} />
          <Route path="/student/purchase-history" element={<PurchaseHistory />} />
          <Route path="/student/payments" element={<PurchaseHistory />} />
          <Route
            path="/student/learning/:courseId"
            element={<CourseLearningPage />}
          />
          <Route
            path="/student/learning/:courseId/assessments/:assessmentId"
            element={<AssessmentPage />}
          />
          <Route
            path="/student/learning/courses/:courseId/assessments/:assessmentId"
            element={<AssessmentPage />}
          />
        </Route>

        {/* Authenticated pages that use the common application layout */}
        <Route element={<AppLayout />}>
          <Route
            element={
              <PermissionRoute
                allowedRoles={USER_MANAGEMENT_ROLES}
                anyPermissionCodes={USER_MANAGEMENT_PERMISSIONS}
              />
            }
          >
            <Route path="/admin/users" element={<UserManagement />} />
          </Route>

          <Route
            element={
              <PermissionRoute
                allowedRoles={["ADMIN"]}
                anyPermissionCodes={COMPENSATION_PERMISSIONS}
              />
            }
          >
            <Route
              path="/admin/payroll/compensation"
              element={<CompensationManagement />}
            />
            <Route
              path="/admin/payroll/referral-master"
              element={<ReferralMaster />}
            />
          </Route>

          {/* Community: Admin, Instructor and Student */}
          <Route element={<RoleRouter allowedRoles={["ADMIN", "INSTRUCTOR", "STUDENT"]} />}>
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/community/discussions" element={<CommunityPage />} />
            <Route
              path="/community/my-discussions"
              element={<CommunityPage mineOnly />}
            />
            <Route
              path="/community/bookmarks"
              element={<CommunityPage bookmarksOnly />}
            />
            <Route
              path="/community/posts/:postId"
              element={<PostDetailsPage />}
            />
            <Route
              path="/community/my-discussions/posts/:postId"
              element={<PostDetailsPage />}
            />
            <Route
              path="/community/notifications"
              element={<NotificationsPage />}
            />
            <Route
              path="/community/notification"
              element={<NotificationsPage />}
            />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/notification" element={<NotificationsPage />} />
            <Route
              path="/admin/notifications"
              element={<NotificationsPage />}
            />
            <Route
              path="/admin/community/notifications"
              element={<NotificationsPage />}
            />
          </Route>

          {/* Admin module */}
          <Route element={<RoleRouter allowedRoles={["ADMIN"]} />}>
            <Route
              path="/admin"
              element={<Navigate to="/admin/dashboard" replace />}
            />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route
              path="/admin/community/reports"
              element={<ReportedDiscussionsPage />}
            />
            <Route path="/admin/courses" element={<AdminCoursePage />} />
            <Route
              path="/admin/courses/pending"
              element={<AdminCoursePage initialTab={1} />}
            />
            <Route
              path="/admin/enrollments"
              element={<AdminEnrollmentsPage />}
            />
            <Route path="/admin/reports/payroll" element={<PayrollReportPage />} />
            <Route
              path="/admin/reports/enrollments"
              element={<EnrollmentReportPage />}
            />
            <Route path="/admin/reports/users" element={<UserReportPage />} />
            <Route
              path="/admin/course-categories"
              element={<CourseCategoryPage />}
            />
            <Route
              path="/admin/settings/roles"
              element={<RoleManagementPage />}
            />
            <Route
              path="/admin/settings/permissions"
              element={<PermissionManagementPage />}
            />
            <Route
              path="/admin/settings/role-menu-privileges"
              element={<RoleMenuPrivilegesPage />}
            />
            <Route
              path="/admin/settings/role-permissions"
              element={<RoleMenuPrivilegesPage />}
            />
            <Route
              path="/admin/master-data/institutions"
              element={<InstitutionPage />}
            />
            <Route
              path="/admin/master-data/coupons"
              element={<CouponPage />}
            />
            <Route
              path="/admin/master-data/coupons/courses"
              element={<CouponCoursePage />}
            />
            <Route
              path="/admin/master-data/coupons/students"
              element={<CouponStudentPage />}
            />
            <Route
              path="/admin/master-data/coupons/redemptions"
              element={<CouponRedemptionPage />}
            />
            <Route
              path="/admin/master-data/students"
              element={<StudentAdmin />}
            />
            <Route
              path="/admin/master-data/instructors"
              element={<InstructorAdmin />}
            />
            <Route path="/admin/payments" element={<AdminPaymentsPage />} />
            <Route
              path="/admin/reports/payments"
              element={<AdminPaymentReportPage />}
            />
            <Route
              path="/admin/payments/reports"
              element={<AdminPaymentReportPage />}
            />
            <Route
              path="/admin/payments/transactions"
              element={<AdminTransactionsPage />}
            />
            <Route path="/admin/payments/refunds" element={<AdminRefundsPage />} />
            <Route
              path="/admin/payments/webhooks"
              element={<AdminWebhooksPage />}
            />
            <Route path="/admin/payroll/periods" element={<PayrollPeriods />} />
            <Route
              path="/admin/payroll/instructor-payrolls"
              element={<AdminInstructorPayrollPage />}
            />
            <Route
              path="/admin/payroll/course-earnings"
              element={<CourseEarnings />}
            />
            <Route
              path="/admin/payroll/payments"
              element={<PaymentManagement />}
            />
            <Route
              path="/admin/payroll/reports"
              element={<PayrollReportsPage />}
            />
            <Route path="/profile" element={<AdminProfilePage />} />
            <Route
              path="/admin/profile"
              element={<Navigate to="/profile" replace />}
            />
          </Route>

          {/* Student assessment pages */}
          <Route element={<RoleRouter allowedRoles={["STUDENT"]} />}>
            <Route
              path="/student/assessments"
              element={<StudentAssessmentPage />}
            />
            <Route
              path="/student/assessments/:assessmentId"
              element={<StudentAssessmentDetailsPage />}
            />
            <Route
              path="/student/assessments/attempts/:attemptId"
              element={<TakeAssessmentPage />}
            />
            <Route
              path="/student/assessments/attempts/:attemptId/result"
              element={<StudentAssessmentResultPage />}
            />
            <Route
              path="/my-learning/results"
              element={<Navigate to="/student/assessments" replace />}
            />
          </Route>

          {/* Instructor module */}
          <Route element={<RoleRouter allowedRoles={["INSTRUCTOR"]} />}>
            <Route
              path="/instructor"
              element={<Navigate to="/instructor/dashboard" replace />}
            />
            <Route
              path="/instructor/dashboard"
              element={<InstructorDashboard />}
            />

            <Route
              path="/instructor/reports/enrollments"
              element={<InstructorEnrollmentReportPage />}
            />

            <Route
              path="/instructor/enrollments"
              element={<InstructorEnrollmentReportPage />}
            />

            <Route
              path="/instructor/students"
              element={<InstructorEnrollmentReportPage />}
            />

            {/* INSTRUCTOR COURSE MANAGEMENT */}

            <Route
              path="/instructor/all-courses"
              element={<AllCoursesPage />}
            />
            <Route
              path="/instructor/course-categories"
              element={<CourseCategoriesPage />}
            />
            <Route path="/instructor/courses" element={<MyCoursesPage />} />
            <Route
              path="/instructor/courses/create"
              element={<CreateCoursePage />}
            />
            <Route
              path="/instructor/courses/:id"
              element={<ViewCoursePage />}
            />
            <Route
              path="/instructor/courses/:id/edit"
              element={<EditCoursePage />}
            />
            <Route
              path="/instructor/courses/:id/curriculum"
              element={<CourseCurriculumPage />}
            />
            <Route
              path="/instructor/profile"
              element={<InstructorProfilePage />}
            />
            <Route
              path="/instructor/assessments"
              element={<InstructorAssessmentsPage />}
            />
            <Route
              path="/instructor/assessment-results"
              element={<AssessmentResultsPage />}
            />

            <Route
              path="/instructor/assessments/:assessmentId/manage"
              element={<AssessmentManagePage />}
            />
            <Route
              path="/instructor/assessments/:assessmentId/results"
              element={<AssessmentResultsPage />}
            />
            <Route
              path="/instructor/assessments/:assessmentId/results/:attemptId"
              element={<AssessmentAttemptReviewPage />}
            />
            <Route
              path="/assessments/questions"
              element={<InstructorQuestionBankPage />}
            />
            <Route
              path="/assessments/exams"
              element={<InstructorAssessmentsPage />}
            />
            <Route
              path="/instructor/payroll"
              element={<InstructorEarningsOverviewPage />}
            />
            <Route
              path="/instructor/payroll/course-earnings"
              element={<InstructorCourseWiseEarningsPage />}
            />
            <Route
              path="/instructor/payroll/history"
              element={<InstructorPayrollHistoryPage />}
            />
            <Route
              path="/instructor/payroll/payments"
              element={<InstructorPaymentHistoryPage />}
            />
            <Route
              path="/instructor/payroll/payslip"
              element={<InstructorPayslipPage />}
            />
          </Route>
        </Route>
      </Route>

      {/* Unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
