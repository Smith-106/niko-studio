import { gettingStartedContent } from './content-getting-started';
import { guidesContent } from './content-guides';
import { writingContent } from './content-writing';
import { graphContent } from './content-graph';
import { criticContent } from './content-critic';
import { worldviewContent } from './content-worldview';
import { agentContent } from './content-agent';
import { knowledgeContent } from './content-knowledge';
import { memoryContent } from './content-memory';
import { desktopContent } from './content-desktop';
import { syncContent } from './content-sync';
import { architectureContent } from './content-architecture';
import { apiContent } from './content-api';

const contentMap: Record<string, string> = {
  ...gettingStartedContent,
  ...guidesContent,
  ...writingContent,
  ...graphContent,
  ...criticContent,
  ...worldviewContent,
  ...agentContent,
  ...knowledgeContent,
  ...memoryContent,
  ...desktopContent,
  ...syncContent,
  ...architectureContent,
  ...apiContent,
};

export function getDocContent(pageId: string): string {
  return contentMap[pageId] || '<p>文档内容正在编写中...</p>';
}
