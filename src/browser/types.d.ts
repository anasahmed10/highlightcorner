interface ESPNTeam {
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  color?: string;
  alternateColor?: string;
  logo?: string;
}
interface ESPNCompetitor {
  homeAway?: 'home' | 'away';
  team?: ESPNTeam;
  score?: string | number;
  winner?: boolean;
  records?: Array<{ summary?: string }>;
}
interface ESPNStatus {
  type?: { state?: string; completed?: boolean; shortDetail?: string; detail?: string };
}
interface ESPNCompetition {
  date?: string;
  competitors?: ESPNCompetitor[];
  status?: ESPNStatus;
  season?: { year?: number };
  week?: { number?: number };
}
interface ESPNEvent {
  id?: string | number;
  date?: string;
  competitions?: ESPNCompetition[];
  status?: ESPNStatus;
}
interface ESPNScoreboard {
  events?: ESPNEvent[];
  season?: { year?: number; type?: number };
  leagues?: Array<{ season?: { year?: number; type?: { type?: number } } }>;
  week?: { number?: number };
}
interface GameTeam {
  abbr: string;
  name: string;
  short: string;
  score?: string | number;
  winner: boolean;
  record: string;
  color?: string;
  altColor?: string;
  logo?: string;
}
interface GameInfo {
  id: string;
  date?: string;
  statusText: string;
  state: string;
  completed: boolean;
  away: GameTeam;
  home: GameTeam;
}
type GameVerdict = 'nail-biter' | 'comfortable' | 'garbage-time' | 'blowout';
interface Recap {
  gameId: string;
  season: number;
  week: number;
  away: string;
  home: string;
  awayScore: number;
  homeScore: number;
  headline: string;
  recap: string;
  keyStat: string;
  verdict: GameVerdict;
}
interface PlayerRecord { n: string; p: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'; t: string }
type PlayerMap = Record<string, PlayerRecord>;
type SleeperStats = Record<string, Record<string, unknown>>;
interface HighlightLink { url: string; source: 'YouTube' | 'NFL.com'; channelId?: string; verifiedAt: string }
interface HighlightMap { version?: number; status?: string; games?: Record<string, HighlightLink> }
interface HCContext { season: number; week: number; verified?: boolean }
interface SeasonWindow { providerSeason: number; currentWeek: number; verified: boolean; phase: 'current' | 'last' | 'upcoming' }
interface HCAPI {
  initTheme(): void;
  theme(): string;
  initNav(active?: string): void;
  fetchJSON<T = unknown>(url: string): Promise<T>;
  startVisiblePolling(callback: () => void | Promise<void>, interval?: number): () => void;
  scoreboard(week?: number, season?: number): Promise<ESPNScoreboard>;
  gameSummary(id: string): Promise<ESPNGameSummary>;
  fetchRecaps(): Promise<Recap[]>;
  gameInfo(event: ESPNEvent): GameInfo;
  gameVerdict(game: GameInfo, summary?: ESPNGameSummary): GameVerdict | null;
  fmtDate(iso?: string): string;
  fmtDateShort(iso?: string): string;
  highlightLink(map: HighlightMap | null, id: string): Pick<HighlightLink, 'url' | 'source'> | null;
  highlightPending(map: HighlightMap | null, completed: boolean): string;
  teamTextColors(away: { color?: string; altColor?: string }, home: { color?: string; altColor?: string }): { away: string; home: string };
  esc(value: unknown): string;
  weekOptions(selectEl: HTMLSelectElement, selectedWeek?: number): Promise<number>;
  context: HCContext;
  seasonWindow: SeasonWindow;
  gameURL(id: string | number, context?: HCContext): string;
  setContext(season: string | number, week: number, verified?: boolean): HCContext;
  selectSeasonWeek(seasonEl: HTMLSelectElement, weekEl: HTMLSelectElement, requestedWeek?: string | number | null): HCContext;
  initSeasonWeek(seasonEl: HTMLSelectElement, weekEl: HTMLSelectElement): Promise<HCContext>;
  statusClass(game: GameInfo): string;
  statusLabel(game: GameInfo): string;
  prefs: { get<T>(key: string, fallback: T): T; set<T>(key: string, value: T): void };
  TEAMS32: string[];
  spoilersHidden(): boolean;
  applySpoilers(): void;
  initPrefs(): void;
  isWatched(id: string | number): boolean;
  toggleWatched(id: string | number): boolean;
  getFavorites(): string[];
  toggleFavorite(abbr: string): boolean;
  captureFocus(root: HTMLElement): () => void;
  initTabs(root: HTMLElement): void;
  sortTables(root: HTMLElement): void;
  contentReady(root: HTMLElement): void;
  skeletons(count?: number, rows?: number): string;
  copyLink(text: string, button?: HTMLButtonElement | null): Promise<void>;
  renderAds?: () => void;
}
declare const HC: HCAPI;
interface Window {
  HC: HCAPI;
  HC_GAME_PAGES?: Record<string, number>;
  adsbygoogle?: Record<string, unknown>[];
}
interface Navigator { standalone?: boolean }
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}

/* ESPN summary sections are sparse and vary by game state. All fields read by
   the game renderer are optional so missing sections must be handled at use. */
interface ESPNAthlete { athlete: { id: string; displayName: string }; stats?: Array<string | number> }
interface ESPNStatGroup { name?: string; text?: string; keys?: string[]; labels?: string[]; athletes?: ESPNAthlete[] }
interface ESPNBoxTeam { team?: ESPNTeam; statistics?: ESPNStatGroup[] }
interface ESPNTeamStats { team?: ESPNTeam; statistics?: Array<{ name?: string; displayValue?: string; value?: string; summary?: string }> }
interface ESPNInjuryTeam { team?: ESPNTeam; injuries?: Array<{ athlete?: { displayName?: string }; details?: string; longComment?: string; shortComment?: string; status?: string; date?: string }> }
interface ESPNScoringPlay { period?: { number?: number }; clock?: { value?: number; displayValue?: string }; team?: ESPNTeam; text?: string; awayScore?: number; homeScore?: number }
interface ESPNGameSummary {
  header?: { competitions?: ESPNCompetition[]; season?: { year?: number }; week?: { number?: number }; status?: ESPNStatus };
  gameInfo?: { venue?: { fullName?: string } };
  scoringPlays?: ESPNScoringPlay[];
  boxscore?: { players?: ESPNBoxTeam[]; teams?: ESPNTeamStats[] };
  injuries?: ESPNInjuryTeam[];
}
