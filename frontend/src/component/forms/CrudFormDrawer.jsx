import { forwardRef } from "react";
import { Dialog, Slide } from "@mui/material";

const DrawerTransition = forwardRef(function DrawerTransition(props, ref) {
  return <Slide direction="left" ref={ref} {...props} />;
});

const drawerPaperSx = {
  width: { xs: "100vw", sm: 560 },
  maxWidth: "min(640px, 100vw)",
  height: "100dvh",
  maxHeight: "100dvh",
  m: 0,
  display: "flex",
  flexDirection: "column",
  borderRadius: { xs: 0, sm: "20px 0 0 20px" },
  overflow: "hidden",
  boxShadow: "-18px 0 55px rgba(21, 18, 48, 0.18)",
};

const mergeSx = (...values) => values.flatMap((value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
});

export default function CrudFormDrawer({
  children,
  className = "",
  slots,
  slotProps,
  ...dialogProps
}) {
  return (
    <Dialog
      {...dialogProps}
      className={["crud-form-drawer", className].filter(Boolean).join(" ")}
      slots={{ ...slots, transition: DrawerTransition }}
      slotProps={{
        ...slotProps,
        container: {
          ...slotProps?.container,
          sx: mergeSx(
            {
              height: "100dvh",
              justifyContent: "flex-end",
              alignItems: "stretch",
            },
            slotProps?.container?.sx
          ),
        },
        backdrop: {
          ...slotProps?.backdrop,
          sx: mergeSx(
            { backgroundColor: "rgba(20, 19, 36, 0.42)", backdropFilter: "blur(3px)" },
            slotProps?.backdrop?.sx
          ),
        },
        paper: {
          ...slotProps?.paper,
          sx: mergeSx(drawerPaperSx, slotProps?.paper?.sx),
        },
        transition: {
          ...slotProps?.transition,
          direction: "left",
        },
      }}
    >
      {children}
    </Dialog>
  );
}
