/**
 * Site-wide announcement banner content.
 *
 * Authoring workflow: edit `ANNOUNCEMENT` below, then commit. GitHub Actions
 * deploys on push to `main`. To force every visitor to see a refreshed
 * announcement (even those who dismissed the prior one), change `id` to a new
 * value — the App stores the last-dismissed id under
 * `sophia.announcement.dismissed.v1` and a non-matching id re-shows the banner.
 *
 * To take the banner offline without removing the code, flip `enabled` to false.
 */

export interface Announcement {
  /** Bumped version string. Changing this re-shows the banner to all users. */
  id: string;
  /** Master switch. When false, the banner is never rendered. */
  enabled: boolean;
  /** Optional small uppercase eyebrow (e.g. 'ANNOUNCEMENT · 公告'). */
  eyebrow?: string;
  /** Main headline rendered in the museum serif. */
  title: string;
  /** One- or two-sentence body copy. */
  body: string;
  /** Optional call-to-action. `href` should be a same-origin route the App knows about. */
  cta?: { label: string; href: string };
}

export const ANNOUNCEMENT: Announcement = {
  id: 'welcome-2026-05',
  enabled: true,
  eyebrow: 'ANNOUNCEMENT · 公告',
  title: '欢迎来到 Sophia\'s Dialectic',
  body: '这是一台把现代困惑展开为哲学分析的引擎。输入一个问题，看见思想的岔路。目前配置了GPT-5.4-mini以及mimo-v2.5-pro等模型，不同模型生成所需的时间也不一样，后续会陆续开放更多模型和功能，敬请期待！',
  cta: { label: '阅读理念', href: '/manifesto' },
};
