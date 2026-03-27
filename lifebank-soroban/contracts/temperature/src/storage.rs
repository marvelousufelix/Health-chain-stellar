use soroban_sdk::{Env, Vec};
use crate::types::{DataKey, TemperatureReading, TemperatureThreshold};

// ── Storage TTL constants ─────────────────────────────────────────────────────
/// Threshold below which instance storage is extended (≈ 30 days).
const INSTANCE_BUMP_THRESHOLD: u32 = 518_400;
/// Target TTL for instance storage after bump (≈ 1 year).
const INSTANCE_BUMP_AMOUNT: u32 = 6_307_200;

/// Threshold below which persistent entries are extended (≈ 30 days).
const PERSISTENT_BUMP_THRESHOLD: u32 = 518_400;
/// Target TTL for persistent entries after bump (≈ 1 year).
const PERSISTENT_BUMP_AMOUNT: u32 = 6_307_200;

/// Extend instance storage TTL. Call in frequently-accessed functions.
pub fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

pub fn get_admin(env: &Env) -> soroban_sdk::Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap()
}

pub fn set_admin(env: &Env, admin: &soroban_sdk::Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

pub fn get_threshold(env: &Env, unit_id: u64) -> Option<TemperatureThreshold> {
    env.storage()
        .persistent()
        .get(&DataKey::Threshold(unit_id))
}

pub fn set_threshold(env: &Env, unit_id: u64, threshold: &TemperatureThreshold) {
    env.storage()
        .persistent()
        .set(&DataKey::Threshold(unit_id), threshold);
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::Threshold(unit_id), PERSISTENT_BUMP_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
}

pub fn get_temp_page(
    env: &Env,
    unit_id: u64,
    page: u32,
) -> Vec<TemperatureReading> {
    env.storage()
        .persistent()
        .get(&DataKey::TempPage(unit_id, page))
        .unwrap_or_else(|| Vec::new(env))
}

pub fn set_temp_page(
    env: &Env,
    unit_id: u64,
    page: u32,
    readings: &Vec<TemperatureReading>,
) {
    env.storage()
        .persistent()
        .set(&DataKey::TempPage(unit_id, page), readings);
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::TempPage(unit_id, page), PERSISTENT_BUMP_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
}

pub fn get_temp_page_len(env: &Env, unit_id: u64, page: u32) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::TempPageLen(unit_id, page))
        .unwrap_or(0)
}

pub fn set_temp_page_len(env: &Env, unit_id: u64, page: u32, len: u32) {
    env.storage()
        .persistent()
        .set(&DataKey::TempPageLen(unit_id, page), &len);
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::TempPageLen(unit_id, page), PERSISTENT_BUMP_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
}
