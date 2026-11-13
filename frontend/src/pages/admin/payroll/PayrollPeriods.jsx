import PayrollResourcePage from "./PayrollResourcePage";
import { payrollPageConfig } from "./payrollPageConfig";

export default function PayrollPeriods() {
  return (
    <PayrollResourcePage config={payrollPageConfig.period} />
  );
}