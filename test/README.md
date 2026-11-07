# Tests

Node test coverage currently checks the TSDoc parser wrapper and runtime/type-only extraction baseline.

Run:

```sh
npm test
```

项目AST与结构类型实链使用单worker串行执行，避免多个原生编译器快照叠加内存。 Project AST and structured-type chains run serially with one worker to bound concurrent native compiler snapshots.
