export default function Spec() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">XRON Format Specification</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
        Extensible Reduced Object Notation — a lossless serialization format designed to minimize token consumption when communicating with large language models.
      </p>

      <Section title="Overview">
        <p>
          XRON achieves up to <strong>80% token reduction</strong> versus JSON by applying a 6-layer compression pipeline:
          schema extraction, positional streaming, dictionary encoding, type-aware encoding, delta compression, and tokenizer alignment.
          It is fully lossless — any XRON document can be round-tripped back to the original JSON value without loss of type information.
        </p>
      </Section>

      <Section title="Compression Levels">
        <div className="flex flex-col gap-6">
          <LevelCard
            level={1}
            subtitle="Human-Readable (~60% reduction)"
            description="Extracts repeated object shapes into named schemas and uses positional (comma-separated) rows instead of key:value pairs. Nested objects are indented. Output remains easily readable."
            example={`@v1
@S A: id, name, department, active, salary
@N5 A
1, Alice Johnson, Sales, true, 50000
2, Bob Smith, Engineering, false, 51000
3, Carol Williams, Marketing, true, 52000
4, Dave Brown, HR, false, 53000
5, Eve Davis, Finance, true, 54000`}
          />
          <LevelCard
            level={2}
            subtitle="Compact (~70% reduction)"
            description="Adds a global dictionary (@D) for frequently repeated string values. References replace repeated strings with $index notation, further reducing token count."
            example={`@v2
@S A: id, name, department, active, salary
@D: Sales, Engineering, Marketing, HR, Finance
@N5 A
1, Alice Johnson, $0, true, 50000
2, Bob Smith, $1, false, 51000
3, Carol Williams, $2, true, 52000
4, Dave Brown, $3, false, 53000
5, Eve Davis, $4, true, 54000`}
          />
          <LevelCard
            level={3}
            subtitle="Maximum (~80% reduction)"
            description="Applies delta encoding to sequential numeric columns. Instead of repeating full values, consecutive rows use +N (or -N) notation to express the difference from the previous value."
            example={`@v3
@S A: id, name, department, active, salary
@D: Sales, Engineering, Marketing, HR, Finance
@N5 A
1, Alice Johnson, $0, true, 50000
+1, Bob Smith, $1, false, +1000
+1, Carol Williams, $2, true, +1000
+1, Dave Brown, $3, false, +1000
+1, Eve Davis, $4, true, +1000`}
          />
        </div>
      </Section>

      <Section title="Syntax Reference">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-300 font-semibold w-36">Token</th>
              <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-300 font-semibold w-40">Example</th>
              <th className="text-left py-2 text-gray-600 dark:text-gray-300 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            <SyntaxRow token="@vN" example="@v2" desc="Version header — specifies the XRON compression level (1, 2, or 3)." />
            <SyntaxRow token="@S name: f1, f2" example="@S A: id, name" desc="Schema declaration — defines field order for a named schema." />
            <SyntaxRow token="@D: v1, v2" example="@D: Sales, HR" desc="Dictionary header — lists values available as $index references." />
            <SyntaxRow token="@NN schema" example="@N3 A" desc="Cardinality header — signals N rows of the named schema follow." />
            <SyntaxRow token="$N" example="$0" desc="Dictionary reference — replaced with the Nth dictionary entry at parse time." />
            <SyntaxRow token="+N / -N" example="+1000" desc="Delta value — numeric difference from the previous row's value in this column." />
            <SyntaxRow token='"..."' example='"hello, world"' desc="Quoted string — used when a value contains commas, quotes, or special characters." />
          </tbody>
        </table>
      </Section>

      <Section title="6-Layer Pipeline">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li><strong>Schema Extraction</strong> — Identifies repeated object shapes and assigns short schema names (A, B, C…).</li>
          <li><strong>Positional Streaming</strong> — Replaces <code>key: value</code> pairs with comma-separated positional rows, eliminating key repetition.</li>
          <li><strong>Dictionary Encoding</strong> — Builds a frequency-sorted dictionary of common string values; high-frequency values are replaced with <code>$index</code>.</li>
          <li><strong>Type-Aware Encoding</strong> — Encodes booleans, nulls, and numbers without quotes, preserving type information losslessly.</li>
          <li><strong>Delta Compression</strong> — Detects monotonically increasing/decreasing numeric columns and replaces values with signed deltas.</li>
          <li><strong>Tokenizer Alignment</strong> — Adjusts separators and whitespace to minimize BPE token boundaries for the target tokenizer (o200k_base by default).</li>
        </ol>
      </Section>

      <Section title="API">
        <CodeBlock>{`import { XRON } from '@xron-format/xron'

// Serialize to XRON (Level 2 by default)
const xron = XRON.stringify(data, { level: 2 })

// Parse back to original value (lossless)
const restored = XRON.parse(xron)

// Analyze compression metrics
const stats = await XRON.analyze(data)
// { inputTokens, outputTokens, reduction, schemas, dictEntries, deltaColumns }

// Options
XRON.stringify(data, {
  level: 3,           // 1 | 2 | 3
  tokenizer: 'o200k_base',  // 'o200k_base' | 'cl100k_base' | 'claude'
  maxDictSize: 256,
  deltaThreshold: 3,
})`}</CodeBlock>
      </Section>

      <Section title="Round-Trip Guarantee">
        <p>
          Every value serialized with <code>XRON.stringify</code> is guaranteed to be recoverable with <code>XRON.parse</code>.
          This includes: nested objects, arrays, booleans, numbers (integers and floats), null, and strings containing
          commas, quotes, newlines, or special characters. Type information is preserved without wrapping scalars in type annotations.
        </p>
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        {title}
      </h2>
      <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}

function LevelCard({ level, subtitle, description, example }: {
  level: number
  subtitle: string
  description: string
  example: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-1">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold">
            L{level}
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">Level {level}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
      </div>
      <pre className="p-4 text-xs font-mono bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-300 overflow-x-auto leading-relaxed">
        {example}
      </pre>
    </div>
  )
}

function SyntaxRow({ token, example, desc }: { token: string; example: string; desc: string }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-2 pr-4 text-violet-600 dark:text-violet-400">{token}</td>
      <td className="py-2 pr-4 text-gray-800 dark:text-gray-300">{example}</td>
      <td className="py-2 text-gray-600 dark:text-gray-400 font-sans">{desc}</td>
    </tr>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="p-4 rounded-xl text-xs font-mono bg-gray-950 dark:bg-gray-950 text-gray-300 overflow-x-auto leading-relaxed border border-gray-800">
      {children}
    </pre>
  )
}
