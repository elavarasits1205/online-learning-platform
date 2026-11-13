import PayrollResourcePage from "./PayrollResourcePage";
import { payrollPageConfig } from "./payrollPageConfig";

export default function PaymentManagement() {
  return (
    <PayrollResourcePage config={payrollPageConfig.payment} />
  );
}