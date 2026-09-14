module.exports = {
  testEnvironment: "node",

  roots: [
    "<rootDir>/test"
  ],

  moduleFileExtensions: [
    "ts",
    "js"
  ],

  clearMocks: true,

  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json"
      }
    ]
  }
};