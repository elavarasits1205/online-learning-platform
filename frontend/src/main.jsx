
import React from "react";
import { createRoot } from "react-dom/client";
import {
  CssBaseline,
  ThemeProvider,
  createTheme
} from "@mui/material";
import { BrowserRouter } from "react-router-dom";

import AppRouter from "./routes/AppRouter";
import "./Styles/crud-ui.scss";
import "./global.scss";
import "./pages/Student/studentLayout.scss";

const theme = createTheme({
  palette: {
    primary: {
      main: "#5b35e8",
      dark: "#4320c7",
      light: "#eee9ff"
    },
    secondary: {
      main: "#ff7655"
    },
    background: {
      default: "#f7f9fc",
      paper: "#ffffff"
    },
    text: {
      primary: "#11172f",
      secondary: "#64708a"
    }
  },
  typography: {
    fontFamily: '"DM Sans", "Manrope", Arial, sans-serif',
    h1: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800 },
    h2: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800 },
    h3: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800 },
    h4: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800 },
    h5: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800 },
    h6: { fontFamily: '"Manrope", "DM Sans", sans-serif', fontWeight: 800 },
    button: {
      textTransform: "none",
      fontWeight: 700
    }
  },
  shape: {
    borderRadius: 12
  },
  components: {
    // Keep the page width stable while MUI locks body scrolling for a popup.
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollbarGutter: "stable",
        },
        'body[style*="overflow: hidden"]': {
          paddingRight: "0 !important",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 11,
          padding: "10px 18px",
          boxShadow: "none"
        },
        containedPrimary: {
          boxShadow: "0 8px 20px rgba(91,53,232,.2)"
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          overflow: "hidden",
          border: "1px solid #e9e8f2",
          borderRadius: 16,
          boxShadow: "0 2px 8px rgba(24, 22, 54, 0.035)",
          transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
          "&:hover": {
            borderColor: "#d8d2f0",
            boxShadow: "0 10px 28px rgba(24, 22, 54, 0.07)"
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 14 },
        outlined: { borderColor: "#e9e8f2" }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: "#f8f7fc",
          "& .MuiTableCell-root": {
            color: "#58566d",
            fontWeight: 700,
            borderBottomColor: "#e9e8f2"
          }
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.01em"
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 54,
          borderRadius: 12,
          backgroundColor: "#fff",
          transition: "box-shadow 160ms ease, border-color 160ms ease",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#e5e3ef"
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#8b73f3"
          },
          "&.Mui-focused": {
            boxShadow: "0 0 0 3px rgba(91, 53, 232, 0.12)"
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#5b35e8",
            borderWidth: 1
          },
          "& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button": {
            opacity: 1,
            height: "auto"
          }
        },
        input: {
          padding: "14px 15px"
        },
        inputMultiline: {
          padding: "14px 15px"
        }
      }
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          minHeight: "unset",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          lineHeight: 1.4,
          paddingTop: 14,
          paddingBottom: 14
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          maxWidth: "min(92vw, 560px)",
          maxHeight: 360,
          border: "1px solid #e8e5f1",
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(23, 21, 43, 0.14)"
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 44,
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          lineHeight: 1.4,
          paddingTop: 9,
          paddingBottom: 9
        }
      }
    }
  }
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
