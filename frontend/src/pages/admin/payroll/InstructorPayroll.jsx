import PayrollResourcePage from "./PayrollResourcePage";
import { payrollPageConfig } from "./payrollPageConfig";

export default function InstructorPayroll() {
  return (
    <PayrollResourcePage config={payrollPageConfig.instructorPayroll} />
  );
}