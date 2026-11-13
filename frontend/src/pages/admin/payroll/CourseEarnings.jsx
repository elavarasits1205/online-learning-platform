import PayrollResourcePage from "./PayrollResourcePage";
import { payrollPageConfig } from "./payrollPageConfig";

export default function CourseEarnings() {
  return (
    <PayrollResourcePage config={payrollPageConfig.courseEarning} />
  );
}