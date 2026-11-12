-- The first tables.
CREATE TABLE book (
  id uuid PRIMARY KEY,
  title text NOT NULL
);

CREATE TABLE borrower (
  id uuid PRIMARY KEY
);

CREATE TABLE scratch (id int);
