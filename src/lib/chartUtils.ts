export const chartTheme = {
    axis: {
        fontSize: 12,
        tickColor: '#6b7280', // gray-500
        strokeColor: '#6b7280', // gray-500
        labelStyle: {
            fill: '#6b7280',
            fontSize: 14,
        },
    },
    grid: {
        strokeDasharray: '3 3',
        stroke: '#374151', // gray-700
        opacity: 0.3,
    },
    tooltip: {
        contentStyle: {
            backgroundColor: '#d1d5db', // gray-300
            borderColor: '#000000',
            borderRadius: '0.5rem', // rounded-lg
            padding: '0.75rem', // p-3
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // shadow-lg
        },
        itemStyle: {
            color: '#111827', // gray-900
            fontSize: '1rem', // text-base (16px)
        },
        labelStyle: {
            color: '#111827', // gray-900
            fontWeight: 500,
            fontSize: '1rem', // text-base (16px)
            marginBottom: '0.5rem', // mb-2
        },
        secondaryTextStyle: {
            color: '#374151', // gray-700
        },
    },
    legend: {
        wrapperStyle: {
            paddingTop: '1rem',
        },
    },
    margin: {
        default: { top: 5, right: 30, left: 20, bottom: 5 },
        scatter: { top: 20, right: 20, bottom: 20, left: 20 },
    },
    bar: {
        radius: [4, 4, 0, 0] as [number, number, number, number],
    },
    line: {
        strokeWidth: 2,
        dot: {
            strokeWidth: 2,
            r: 4,
        },
        activeDot: {
            r: 6,
        },
    },
};
