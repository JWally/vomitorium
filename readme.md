![image](https://github.com/user-attachments/assets/cf6a4b0f-6fb8-4c63-9a7a-c16827c9ed47)


Vomitorium is a command-line tool designed to easily load an entire project into a single text file. It recursively scans directories, processes files, and compiles their contents into a single output file. Useful for working with LLMs.

## Features

- Recursively scan directories
- Include/exclude specific directories and files
- Filter files by extension
- Customizable output file
- Configurable via command-line options or configuration file

## Installation

```bash
npm install -g vomitorium
```

## Usage

```bash
vomitorium [options]
```

### Options

- `--scan <dir>`: Directory to scan (default: current working directory)
- `--include <dirs>`: Comma-separated list of directories to include
- `--exclude <patterns>`: Comma-separated list of directories or files to exclude
- `--extensions <exts>`: Comma-separated list of file extensions to include
- `--show-excluded`: Show excluded files in the output
- `--show-skipped`: Show skipped files without listing their contents
- `--output <file>`: Specify the output file name

### Examples

```bash
vomitorium --scan ./myproject --include src,tests
vomitorium --exclude node_modules,dist,package.json --extensions .js,.ts
vomitorium --scan /path/to/project --show-excluded --show-skipped
vomitorium --output my-custom-output.txt
```

## Configuration

### 1. JSON config File (Recommended)

By default, Vomitorium looks for a file named `sick.json` in your project root. If it finds one, it merges its settings with the internal defaults. You can also specify a custom file path with `--config <path>`.

Here’s an example `sick.json`:

```json
{
  "scan": ".",
  "include": ["bin", "lib", "src", "test"],
  "exclude": ["node_modules", ".git", "dist", "build"],
  "excludeFiles": ["package.json", "package-lock.json"],
  "extensions": [".js", ".ts", ".json"],
  "showExcluded": true,
  "showSkipped": true,
  "outputFile": "output.sick"
}
```

### 2. Cosmiconfig Support (Fallback)
If no JSON file is found at the path you specify (or at sick.json by default), Vomitorium uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for configuration file support. You can create a configuration file named `.vomitoriumrc`, `.vomitoriumrc.json`, `.vomitoriumrc.yaml`, `vomitorium.config.js`, or add a `"vomitorium"` key to your `package.json` file.

If none of these are found, it falls back on its default configuration:

```json
{
  "scan": ".",
  "include": [],
  "exclude": ["node_modules", ".git", "dist", "build"],
  "excludeFiles": ["package.json", "package-lock.json"],
  "extensions": [".js", ".ts", ".json"],
  "showExcluded": true,
  "showSkipped": true,
  "outputFile": "output.sick"
}
```

## Output

The tool generates a single output file (default: `output.sick`) containing the contents of all processed files, separated by file headers.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)
