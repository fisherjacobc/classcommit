CREATE OR REPLACE FUNCTION nanoid_alphanumeric(size int DEFAULT 21)
RETURNS text AS $$
DECLARE
  id text := '';
  i int := 0;
  -- Custom alphabet excluding _ and -
  urlAlphabet char(62) := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  bytes bytea := gen_random_bytes(size);
  byte int;
  pos int;
BEGIN
  WHILE i < size LOOP
    byte := get_byte(bytes, i);
    pos := (byte % 62) + 1; -- Modulo 62 for 62 chars
    id := id || substr(urlAlphabet, pos, 1);
    i = i + 1;
  END LOOP;
  RETURN id;
END $$ LANGUAGE PLPGSQL STABLE;