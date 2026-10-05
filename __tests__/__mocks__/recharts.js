// Recharts needs real DOM dimensions, which jsdom doesn't provide. We mock
// each primitive to a simple div so components render without crashing and
// we can assert the data they feed in.
const React = require("react");

// Recharts primitives accept many non-DOM props (dataKey, layout, barSize…).
// We strip them so React doesn't warn about unknown attributes on <div>.
function passthrough(name) {
  const Comp = ({ children, data }) =>
    React.createElement(
      "div",
      {
        "data-chart": name,
        "data-rows": data ? data.length : undefined,
      },
      children
    );
  Comp.displayName = name;
  return Comp;
}

module.exports = {
  ResponsiveContainer: passthrough("ResponsiveContainer"),
  BarChart: passthrough("BarChart"),
  LineChart: passthrough("LineChart"),
  AreaChart: passthrough("AreaChart"),
  Bar: passthrough("Bar"),
  Line: passthrough("Line"),
  Area: passthrough("Area"),
  Cell: passthrough("Cell"),
  XAxis: passthrough("XAxis"),
  YAxis: passthrough("YAxis"),
  Tooltip: passthrough("Tooltip"),
  Legend: passthrough("Legend"),
  CartesianGrid: passthrough("CartesianGrid"),
  ReferenceLine: passthrough("ReferenceLine"),
};
