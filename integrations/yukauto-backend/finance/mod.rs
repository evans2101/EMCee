//! EMCee: master-only, read-only cross-tenant cash flow. No credentials or bank secrets leave here.
#[cfg(test)]
mod integration_tests;
use crate::{app::state::AppState, common::ApiResponse, errors::app_error::AppError};
use axum::extract::{Query, State};
use serde::Deserialize;
use serde_json::Value;
use time::{Date, Duration, OffsetDateTime, UtcOffset};
use uuid::Uuid;

#[derive(Default, Deserialize)]
pub struct FinanceQuery {
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub tenant_id: Option<Uuid>,
    pub source: Option<String>,
    pub search: Option<String>,
    pub status: Option<String>,
    pub direction: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl FinanceQuery {
    fn bounds(&self) -> Result<(OffsetDateTime, OffsetDateTime), AppError> {
        let wib = UtcOffset::from_hms(7, 0, 0).expect("valid WIB offset");
        let today = OffsetDateTime::now_utc().to_offset(wib).date();
        let format =
            time::format_description::parse("[year]-[month]-[day]").expect("valid date format");
        let parse = |value: &str| {
            Date::parse(value, &format)
                .map_err(|_| AppError::BadRequest("Use YYYY-MM-DD for dates".into()))
        };
        let end = self
            .to_date
            .as_deref()
            .map(parse)
            .transpose()?
            .unwrap_or(today);
        let start = self
            .from_date
            .as_deref()
            .map(parse)
            .transpose()?
            .map(Ok)
            .unwrap_or_else(|| {
                end.checked_sub(Duration::days(29))
                    .ok_or_else(|| AppError::BadRequest("Date is out of range".into()))
            })?;
        if start > end || (end - start).whole_days() > 365 {
            return Err(AppError::BadRequest(
                "Choose an ordered date range of at most 366 days".into(),
            ));
        }
        let exclusive_end = end
            .next_day()
            .ok_or_else(|| AppError::BadRequest("Date is out of range".into()))?;
        Ok((
            start.midnight().assume_offset(wib),
            exclusive_end.midnight().assume_offset(wib),
        ))
    }

    fn validate(&self) -> Result<(), AppError> {
        if !["all", "device", "gateway"].contains(&self.source.as_deref().unwrap_or("all"))
            || !["all", "success", "pending", "failed"]
                .contains(&self.status.as_deref().unwrap_or("all"))
            || !["all", "incoming", "outgoing"]
                .contains(&self.direction.as_deref().unwrap_or("all"))
            || self.search.as_ref().is_some_and(|s| s.len() > 200)
            || self.limit.is_some_and(|n| !(1..=200).contains(&n))
            || self.offset.is_some_and(|n| n < 0)
        {
            return Err(AppError::BadRequest(
                "Invalid monitoring filter or pagination".into(),
            ));
        }
        Ok(())
    }
}

#[utoipa::path(get, path="/api/v1/master/monitoring/finance", responses((status=200, description="EMCee cash-flow overview. Inclusive WIB dates; balances are current snapshots, amounts are principal only.", body=Value)), security(("bearer_auth"=[])), tag="monitoring")]
pub async fn overview(
    State(state): State<AppState>,
    Query(q): Query<FinanceQuery>,
) -> Result<ApiResponse<Value>, AppError> {
    q.validate()?;
    let (start, end) = q.bounds()?;
    let sql = format!(
        "{}{}",
        include_str!("events.sql"),
        include_str!("overview.sql")
    );
    let result = sqlx::query_scalar::<_, Value>(&sql)
        .bind(start)
        .bind(end)
        .bind(q.tenant_id)
        .bind(q.source.as_deref().unwrap_or("all"))
        .fetch_one(state.db_pool())
        .await?;
    Ok(ApiResponse::success(result))
}

#[utoipa::path(get, path="/api/v1/master/monitoring/finance/transactions", responses((status=200, description="Paginated normalized PG and device transactions. Same scope and deduplication as overview.", body=Value)), security(("bearer_auth"=[])), tag="monitoring")]
pub async fn transactions(
    State(state): State<AppState>,
    Query(q): Query<FinanceQuery>,
) -> Result<ApiResponse<Value>, AppError> {
    q.validate()?;
    let (start, end) = q.bounds()?;
    let sql = format!(
        "{}{}",
        include_str!("events.sql"),
        include_str!("transactions.sql")
    );
    let result = sqlx::query_scalar::<_, Value>(&sql)
        .bind(start)
        .bind(end)
        .bind(q.tenant_id)
        .bind(q.source.as_deref().unwrap_or("all"))
        .bind(q.search.as_deref().filter(|s| !s.is_empty()))
        .bind(q.status.as_deref().unwrap_or("all"))
        .bind(q.direction.as_deref().unwrap_or("all"))
        .bind(q.limit.unwrap_or(20))
        .bind(q.offset.unwrap_or(0))
        .fetch_one(state.db_pool())
        .await?;
    Ok(ApiResponse::success(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inclusive_wib_dates_cover_utc_boundary() {
        let q = FinanceQuery {
            from_date: Some("2026-10-01".into()),
            to_date: Some("2026-10-01".into()),
            ..Default::default()
        };
        let (start, end) = q.bounds().unwrap();
        assert_eq!(start.to_offset(UtcOffset::UTC).hour(), 17);
        assert_eq!(start.to_offset(UtcOffset::UTC).day(), 30);
        assert_eq!((end - start).whole_hours(), 24);
    }

    #[test]
    fn rejects_bad_scopes_and_unbounded_queries() {
        assert!(FinanceQuery {
            source: Some("other".into()),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(FinanceQuery {
            offset: Some(-1),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(FinanceQuery {
            limit: Some(201),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(FinanceQuery {
            from_date: Some("2026-10-02".into()),
            to_date: Some("2026-10-01".into()),
            ..Default::default()
        }
        .bounds()
        .is_err());
        assert!(FinanceQuery {
            from_date: Some("2020-01-01".into()),
            ..Default::default()
        }
        .bounds()
        .is_err());
    }
}
