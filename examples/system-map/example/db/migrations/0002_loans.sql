CREATE TABLE loan (
  id uuid PRIMARY KEY,
  book_id uuid NOT NULL REFERENCES book (id),
  borrower_id uuid NOT NULL REFERENCES borrower (id)
);

-- "borrower" is called "member" from here on.
ALTER TABLE borrower RENAME TO member;
ALTER TABLE book ADD COLUMN shelf text;
DROP TABLE scratch;
