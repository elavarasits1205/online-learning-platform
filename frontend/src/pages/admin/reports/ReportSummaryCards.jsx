import { Box, Paper, Typography } from "@mui/material";

const FONT_HEADING = "var(--font-heading, 'Manrope', sans-serif)";

export default function ReportSummaryCards({ cards = [] }) {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 190px), 1fr))",
                gap: 2,
                mb: 3,
                alignItems: "stretch",
            }}
        >
            {cards.map((card) => (
                <Box key={card.label} sx={{ minWidth: 0 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2.25,
                            border: "1px solid #e9e8f2",
                            borderRadius: 2,
                            height: "100%",
                        }}
                    >
                        <Typography color="text.secondary" variant="body2">
                            {card.label}
                        </Typography>

                        <Typography
                            variant="h6"
                            sx={{
                                mt: 1,
                                fontFamily: FONT_HEADING,
                                fontWeight: 800,
                            }}
                        >
                            {card.value ?? "-"}
                        </Typography>
                    </Paper>
                </Box>
            ))}
        </Box>
    );
}
