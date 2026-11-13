import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { referralSettingsApi } from "../../../service/payroll.api";

const CURRENCY_OPTIONS = [
  { code: "INR", name: "Indian Rupees" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "ZAR", name: "South African Rand" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "KRW", name: "South Korean Won" },
  { code: "BRL", name: "Brazilian Real" },
];

function getCurrencySymbol(currencyCode) {
  if (!currencyCode) return "";

  try {
    return (
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: 0,
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value || currencyCode
    );
  } catch {
    return currencyCode;
  }
}

export default function ReferralMaster() {
  const [settings, setSettings] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState("INR");
  const [studentDiscount, setStudentDiscount] = useState("0");
  const [instructorIncentive, setInstructorIncentive] = useState("0");
  const [loading, setLoading] = useState(true);
  const [savingCurrency, setSavingCurrency] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const currencySymbol = getCurrencySymbol(selectedCurrency);
  const selectedSetting = settings.find(
    (setting) =>
      String(setting.currency_code || "").trim().toUpperCase() ===
      selectedCurrency
  );

  useEffect(() => {
    let active = true;
    referralSettingsApi.getAll()
      .then((rows) => {
        if (!active) return;

        setSettings(rows);
        const inrSetting = rows.find(
          (setting) =>
            String(setting.currency_code || "").trim().toUpperCase() ===
            "INR"
        );
        setStudentDiscount(String(inrSetting?.student_discount_amount ?? "0"));
        setInstructorIncentive(
          String(inrSetting?.instructor_incentive_amount ?? "0")
        );
      })
      .catch((err) => {
        if (active) setError(err?.message || "Unable to load referral settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function handleCurrencyChange(event) {
    const currencyCode = event.target.value;
    const setting = settings.find(
      (row) =>
        String(row.currency_code || "").trim().toUpperCase() === currencyCode
    );

    setSelectedCurrency(currencyCode);
    setStudentDiscount(String(setting?.student_discount_amount ?? "0"));
    setInstructorIncentive(
      String(setting?.instructor_incentive_amount ?? "0")
    );
  }

  async function saveSettings(event) {
    event.preventDefault();

    if (!selectedCurrency || savingCurrency) return;

    const currencyCode = selectedCurrency;
    setSavingCurrency(currencyCode);
    setError("");
    setMessage("");
    try {
      const saved = await referralSettingsApi.save({
        currency_code: currencyCode,
        student_discount_amount: studentDiscount,
        student_discount_percentage: 0,
        instructor_incentive_amount: instructorIncentive,
      });

      const savedSetting = saved || {
        currency_code: currencyCode,
        student_discount_amount: studentDiscount,
        student_discount_percentage: 0,
        instructor_incentive_amount: instructorIncentive,
        is_active: true,
      };
      setSettings((current) => {
        const exists = current.some(
          (row) =>
            String(row.currency_code || "").trim().toUpperCase() ===
            currencyCode
        );

        return exists
          ? current.map((row) =>
              String(row.currency_code || "").trim().toUpperCase() ===
              currencyCode
                ? savedSetting
                : row
            )
          : [...current, savedSetting].sort((left, right) =>
              left.currency_code.localeCompare(right.currency_code)
            );
      });
      setMessage(`${currencyCode} referral settings saved.`);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to save referral settings.");
    } finally {
      setSavingCurrency("");
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h4" component="h1" gutterBottom>
            Referral Master
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Configure the student referral discount amount and the instructor incentive paid for each successful referral enrollment. The discount is applied when a student uses an approved instructor referral code at checkout.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          {loading ? (
            <CircularProgress size={24} />
          ) : (
            <Box component="form" onSubmit={saveSettings}>
              <Stack spacing={2.5}>
                <FormControl
                  size="small"
                  required
                  sx={{ maxWidth: { xs: "100%", md: 360 } }}
                >
                  <InputLabel id="referral-currency-label">
                    Currency
                  </InputLabel>
                  <Select
                    labelId="referral-currency-label"
                    id="referral-currency"
                    label="Currency"
                    value={selectedCurrency}
                    onChange={handleCurrencyChange}
                    disabled={Boolean(savingCurrency)}
                  >
                    {CURRENCY_OPTIONS.map((currency) => (
                      <MenuItem key={currency.code} value={currency.code}>
                        {currency.code} — {currency.name} ({getCurrencySymbol(currency.code)})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Typography color="text.secondary" variant="body2">
                  {selectedSetting
                    ? `Saved ${selectedCurrency} settings loaded.`
                    : `No ${selectedCurrency} settings yet. Save to add this currency.`}
                </Typography>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Student discount amount"
                    type="number"
                    size="small"
                    value={studentDiscount}
                    onChange={(event) => setStudentDiscount(event.target.value)}
                    disabled={Boolean(savingCurrency)}
                    InputProps={{
                      startAdornment: currencySymbol ? (
                        <InputAdornment position="start">
                          {currencySymbol}
                        </InputAdornment>
                      ) : undefined,
                    }}
                    inputProps={{ min: 0, step: "0.01" }}
                    helperText="Fixed amount off the course price"
                    required
                  />
                  <TextField
                    label="Instructor incentive per paid enrollment"
                    type="number"
                    size="small"
                    value={instructorIncentive}
                    onChange={(event) => setInstructorIncentive(event.target.value)}
                    disabled={Boolean(savingCurrency)}
                    InputProps={{
                      startAdornment: currencySymbol ? (
                        <InputAdornment position="start">
                          {currencySymbol}
                        </InputAdornment>
                      ) : undefined,
                    }}
                    inputProps={{ min: 0, step: "0.01" }}
                    helperText="Fixed amount added to payroll"
                    required
                  />
                </Stack>

                <Box>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={Boolean(savingCurrency)}
                  >
                    {savingCurrency ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      "Save currency settings"
                    )}
                  </Button>
                </Box>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
