# @namespacelabs/actions-toolkit

GitHub Actions toolkit for [Namespace](https://namespace.so).

## Installation

```bash
pnpm add @namespacelabs/actions-toolkit
```

## Packages

### spacectl

Install and execute the [spacectl](https://github.com/namespacelabs/space) CLI.

```typescript
import { install, exec } from "@namespacelabs/actions-toolkit/spacectl";

await install();
const result = await exec(["cache", "modes"]);
```

See [spacectl documentation](src/spacectl/README.md) for detailed usage.

## License

[Apache-2.0](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Links

- [Namespace](https://namespace.so)
- [spacectl CLI](https://github.com/namespacelabs/space)
- [Documentation](https://namespace.so/docs)
