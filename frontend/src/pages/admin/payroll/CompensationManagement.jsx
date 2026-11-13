import PayrollResourcePage from "./PayrollResourcePage";
import { payrollPageConfig } from "./payrollPageConfig";

export default function CompensationManagement() {
  return (
    <PayrollResourcePage config={payrollPageConfig.compensation} />
  );
}
