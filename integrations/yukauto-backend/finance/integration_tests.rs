use serde_json::Value;
use sqlx::{Connection, PgConnection};
use time::{Date, Month, UtcOffset};
use uuid::Uuid;

async fn query(
    conn: &mut PgConnection,
    source: &str,
    tenant: Option<Uuid>,
    list: bool,
    status: &str,
) -> Value {
    let start = Date::from_calendar_date(2026, Month::October, 1)
        .unwrap()
        .midnight()
        .assume_offset(UtcOffset::from_hms(7, 0, 0).unwrap());
    let sql = format!(
        "{}{}",
        include_str!("events.sql"),
        if list {
            include_str!("transactions.sql")
        } else {
            include_str!("overview.sql")
        }
    );
    let query = sqlx::query_scalar::<_, Value>(&sql)
        .bind(start)
        .bind(start + time::Duration::days(1))
        .bind(tenant)
        .bind(source);
    let query = if list {
        query
            .bind(None::<&str>)
            .bind(status)
            .bind("all")
            .bind(2_i64)
            .bind(0_i64)
    } else {
        query
    };
    query.fetch_one(conn).await.unwrap()
}

#[tokio::test]
#[ignore = "requires EMCEE_TEST_DATABASE_URL pointing to a dedicated PostgreSQL test database"]
async fn finance_sql_counts_each_cash_movement_once_and_preserves_scope() {
    let url = std::env::var("EMCEE_TEST_DATABASE_URL").expect("dedicated test database URL");
    let mut conn = PgConnection::connect(&url).await.unwrap();
    sqlx::raw_sql(include_str!("fixtures.sql"))
        .execute(&mut conn)
        .await
        .unwrap();
    let result = query(&mut conn, "all", None, false, "all").await;
    assert_eq!(result["summary"]["incoming"], 1700);
    assert_eq!(result["summary"]["outgoing"], 1600);
    assert_eq!(result["summary"]["total_count"], 11);
    assert_eq!(result["summary"]["success_count"], 7);
    assert_eq!(result["summary"]["pending_count"], 2);
    assert_eq!(result["summary"]["failed_count"], 2);
    assert_eq!(result["summary"]["admin_fee"], 100);
    assert_eq!(result["summary"]["margin"], 30);
    assert_eq!(result["summary"]["unsettled_fee_count"], 1);
    assert_eq!(result["wallet_balance"], 50);
    assert_eq!(result["banks"][0]["account_number_masked"], "•••• 1234");
    assert_eq!(result["devices"][0]["online"], true);
    assert_eq!(result["chart"][0]["incoming"], 1700);
    let gateway = query(&mut conn, "gateway", None, false, "all").await;
    assert_eq!(gateway["summary"]["incoming"], 0);
    assert_eq!(gateway["summary"]["outgoing"], 1300);
    assert_eq!(gateway["summary"]["total_count"], 4);
    let tenant = query(
        &mut conn,
        "all",
        Some(Uuid::parse_str("00000000-0000-4000-8000-000000000001").unwrap()),
        false,
        "all",
    )
    .await;
    assert_eq!(tenant["summary"]["incoming"], 1400);
    assert_eq!(tenant["wallet_balance"], 20);
    let device = query(&mut conn, "device", None, false, "all").await;
    assert_eq!(device["summary"]["outgoing"], 300);
    assert_eq!(device["wallet_balance"], 0);
    let page = query(&mut conn, "all", None, true, "all").await;
    assert_eq!(page["total"], 11);
    assert_eq!(page["rows"].as_array().unwrap().len(), 2);
    let failed = query(&mut conn, "all", None, true, "failed").await;
    assert_eq!(failed["total"], 2);
    let pending = query(&mut conn, "all", None, true, "pending").await;
    assert_eq!(pending["total"], 2);
}
