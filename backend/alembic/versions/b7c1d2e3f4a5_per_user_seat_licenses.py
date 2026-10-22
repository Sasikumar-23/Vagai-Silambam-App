"""per-user seat licenses

Revision ID: b7c1d2e3f4a5
Revises: 3a514c7538b2
Create Date: 2026-10-22
"""
import secrets
import string
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "b7c1d2e3f4a5"
down_revision = "3a514c7538b2"
branch_labels = None
depends_on = None

_KEY_ALPHABET = string.ascii_uppercase + string.digits


def _license_key() -> str:
    groups = ["".join(secrets.choice(_KEY_ALPHABET) for _ in range(4)) for _ in range(3)]
    return "VS-" + "-".join(groups)


def upgrade() -> None:
    op.add_column("licenses", sa.Column("user_id", sa.String(40), nullable=True))
    op.create_foreign_key(
        "fk_licenses_user_id", "licenses", "users", ["user_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_index("ix_licenses_user_id", "licenses", ["user_id"])

    # Every existing academy user gets a seat license so nobody is locked out on deploy.
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, organization_id FROM users "
            "WHERE organization_id IS NOT NULL "
            "AND id NOT IN (SELECT user_id FROM licenses WHERE user_id IS NOT NULL)"
        )
    ).fetchall()
    now = datetime.now(timezone.utc)
    for user_id, organization_id in rows:
        bind.execute(
            sa.text(
                "INSERT INTO licenses (id, organization_id, user_id, license_key, status, "
                "issued_at, created_at, updated_at) "
                "VALUES (:id, :org, :user, :key, 'ACTIVE', :now, :now, :now)"
            ),
            {
                "id": f"lic_{secrets.token_hex(8)}",
                "org": organization_id,
                "user": user_id,
                "key": _license_key(),
                "now": now,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_licenses_user_id", table_name="licenses")
    op.drop_constraint("fk_licenses_user_id", "licenses", type_="foreignkey")
    op.drop_column("licenses", "user_id")
