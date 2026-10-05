const sharedTransform = {
  "^.+\\.(js|jsx)$": [
    "babel-jest",
    {
      presets: [
        ["@babel/preset-env", { targets: { node: "current" } }],
        ["@babel/preset-react", { runtime: "automatic" }],
      ],
    },
  ],
};

module.exports = {
  collectCoverageFrom: [
    "app/**/*.{js,jsx}",
    "components/**/*.{js,jsx}",
    "lib/**/*.{js,jsx}",
    "middleware.js",
    "!**/node_modules/**",
    "!**/.next/**",
    "!**/coverage/**",
  ],
  // Threshold scope grows per phase. Current scope: Phases 2 + 3 (API
  // routes, lib, middleware, components). Phase 4 adds app/*/page.js via
  // Playwright-driven coverage.
  coverageThreshold: {
    "./lib/": { branches: 80, lines: 80, functions: 80, statements: 80 },
    "./app/api/": { branches: 80, lines: 80, functions: 80, statements: 80 },
    "./middleware.js": { branches: 80, lines: 80, functions: 80, statements: 80 },
    "./components/": { branches: 80, lines: 80, functions: 80, statements: 80 },
  },
  projects: [
    {
      displayName: "jsdom",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/__tests__/components/**/*.test.{js,jsx}"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
      moduleNameMapper: {
        "\\.(css|less|scss)$": "<rootDir>/__tests__/__mocks__/styleMock.js",
        "^recharts$": "<rootDir>/__tests__/__mocks__/recharts.js",
      },
      transform: sharedTransform,
    },
    {
      displayName: "node",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/__tests__/lib/**/*.test.js",
        "<rootDir>/__tests__/api/**/*.test.js",
        "<rootDir>/__tests__/middleware.test.js",
      ],
      transform: sharedTransform,
    },
  ],
};
