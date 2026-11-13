import { Link, useLocation } from "react-router-dom";

import { Paper, Tab, Tabs } from "@mui/material";

const SECTIONS = [
    {
        label: "Coupons",
        path: "/admin/master-data/coupons",
    },
    {
        label: "Coupon Courses",
        path: "/admin/master-data/coupons/courses",
    },
    {
        label: "Coupon Students",
        path: "/admin/master-data/coupons/students",
    },
    {
        label: "Coupon Redemptions",
        path: "/admin/master-data/coupons/redemptions",
    },
];

export default function CouponSectionTabs({ sx }) {
    const { pathname } = useLocation();
    const currentPath = pathname.replace(/\/+$/, "") || "/";

    const activePath = SECTIONS.some(
        (section) => section.path === currentPath
    )
        ? currentPath
        : SECTIONS[0].path;

    return (
        <Paper
            variant="outlined"
            sx={{
                borderRadius: 3,
                overflow: "hidden",
                backgroundColor: "background.paper",
                ...sx,
            }}
        >
            <Tabs
                value={activePath}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Coupon management sections"
                sx={{
                    px: 2,
                    borderBottom: 1,
                    borderColor: "divider",
                    "& .MuiTab-root": {
                        minHeight: 58,
                        textTransform: "none",
                        fontWeight: 700,
                    },
                }}
            >
                {SECTIONS.map((section) => (
                    <Tab
                        key={section.path}
                        value={section.path}
                        label={section.label}
                        component={Link}
                        to={section.path}
                    />
                ))}
            </Tabs>
        </Paper>
    );
}
