# xron-cli: Command-Line XRON Serialization Tool

A command-line interface for the XRON lossless serialization engine. Use it to compress and decompress JSON files, or analyze data for potential token savings.

## Installation

```bash
npm install -g xron-cli
```

## Usage

### 1. Compress a file
Compress a JSON file and output to stdout or a file:
```bash
xron compress data.json                    # Output to stdout
xron compress data.json -o data.xron       # Output to data.xron
```

### 2. Decompress a file
Restore an XRON file to its original JSON structure:
```bash
xron decompress data.xron                  # Output to stdout
xron decompress data.xron -o data.json     # Restore to JSON file
```

### 3. Analyze data
Audit potential token savings across all nine XRON compression layers:
```bash
xron analyze data.json
```

## Why Use XRON CLI?
- **Manual Data Preparation:** Prepare large datasets for LLM prompts without writing code.
- **Metric Verification:** Verify exactly how many tokens you're saving before deployment.
- **Workflow Integration:** Incorporate XRON into shell scripts and CI/CD pipelines.

## License
MIT
