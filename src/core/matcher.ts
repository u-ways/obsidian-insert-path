import { AsyncFzf, byLengthAsc, byStartAsc } from "fzf";

export interface MatchResult {
	/** The candidate string (a path relative to the walk root). */
	rel: string;
	/** Character indices in `rel` that matched the query (for highlighting). */
	positions: Set<number>;
	score: number;
}

export interface MatcherOptions {
	/** Max results returned per query. */
	limit?: number;
}

const DEFAULT_LIMIT = 200;

/**
 * Thin wrapper over fzf-for-js that fuzzy-matches a candidate pool.
 *
 * `run()` returns `null` when its result is stale — either a newer `run()`
 * started (small lists resolve before cancellation kicks in, so we guard with a
 * monotonic query id) or fzf cancelled the in-flight search on a large list
 * (it rejects with the bare string `"search cancelled"`, which we swallow).
 */
export class Matcher {
	private finder: AsyncFzf<readonly string[]> | null = null;
	private queryId = 0;
	private readonly limit: number;

	constructor(opts: MatcherOptions = {}) {
		this.limit = opts.limit ?? DEFAULT_LIMIT;
	}

	setCandidates(candidates: readonly string[]): void {
		this.finder = new AsyncFzf(candidates, {
			limit: this.limit,
			selector: (s) => s,
			fuzzy: "v2",
			casing: "smart-case",
			tiebreakers: [byLengthAsc, byStartAsc],
			forward: false,
		});
	}

	async run(query: string): Promise<MatchResult[] | null> {
		if (this.finder === null) return [];
		const id = ++this.queryId;
		try {
			const results = await this.finder.find(query);
			if (id !== this.queryId) return null; // superseded by a newer run
			return results.map((r) => ({ rel: r.item, positions: r.positions, score: r.score }));
		} catch (e) {
			if (e === "search cancelled") return null;
			throw e;
		}
	}
}
