-- Payment records outlive the account they came from. Deleting a parent removes their
-- billing_customers row, which now unlinks their transactions instead of deleting them.
-- What stays is the amount, currency, date, plan (price_id), status and Paddle transaction id:
-- no email, no parent id and no Paddle customer id. Unlinked rows match no RLS policy, so only
-- the service role can read them.
alter table public.transactions alter column paddle_customer_id drop not null;

alter table public.transactions drop constraint transactions_paddle_customer_id_fkey;

alter table public.transactions
  add constraint transactions_paddle_customer_id_fkey
  foreign key (paddle_customer_id) references public.billing_customers (paddle_customer_id)
  on delete set null;

comment on column public.transactions.paddle_customer_id is
  'Null once the parent account is deleted. The payment record itself is kept for accounting.';
