/**
 * Cookbook Example: LangChain Custom Output Parser
 *
 * Parse XRON-encoded LLM responses back into structured objects.
 * Use this when your chain returns tabular data and you want to
 * minimise token usage on the wire while keeping typed output.
 *
 * Install:
 *   npm install xron-format @langchain/core @langchain/openai
 */

import { XRON } from 'xron-format';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BaseTransformOutputParser } from '@langchain/core/output_parsers';

// Custom parser: takes XRON text from the LLM and hydrates it
class XRONOutputParser extends BaseTransformOutputParser<unknown> {
  lc_namespace = ['xron'];

  getFormatInstructions(): string {
    return [
      'Return your answer as XRON-encoded data.',
      'Use @S for schemas, @D for dictionaries, @N for row counts.',
      'Do NOT wrap the output in markdown code fences.',
    ].join(' ');
  }

  async parse(text: string): Promise<unknown> {
    // Strip markdown code fences if the model wraps the response
    const cleaned = text.replace(/^```(?:xron)?\n?/m, '').replace(/\n?```$/m, '');
    return XRON.parse(cleaned);
  }
}

async function main() {
  const model = new ChatOpenAI({ model: 'gpt-4o' });
  const parser = new XRONOutputParser();

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `You are a data generator. ${parser.getFormatInstructions()}`,
    ],
    ['human', '{query}'],
  ]);

  const chain = prompt.pipe(model).pipe(parser);

  const result = await chain.invoke({
    query: 'Generate 5 fictional employees with id, name, department, and active status.',
  });

  console.log('Parsed result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
