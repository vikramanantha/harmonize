// SpacetimeDB Module Definition (Rust Example)
use spacetimedb::{table, reducer, SpacetimeType, Table};

#[table(name = user_profiles, public)]
pub struct UserProfile {
    #[primary_key]
    pub user_id: String,
    pub summary_text: String,
}

#[table(name = profile_matches, public)]
pub struct ProfileMatch {
    #[primary_key]
    pub match_id: String,
    pub user_id_1: String,
    pub user_id_2: String,
    pub similarity_score: f32,
}

#[reducer]
pub fn save_match_score(ctx: &spacetimedb::ReducerContext, user_id_1: String, user_id_2: String, score: f32) {
    let match_id = format!("{}_{}", user_id_1, user_id_2);
    ctx.db.profile_matches().insert(ProfileMatch {
        match_id,
        user_id_1,
        user_id_2,
        similarity_score: score,
    });
}
