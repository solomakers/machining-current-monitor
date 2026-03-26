-- authenticated ユーザーにデバイス登録・更新を許可
CREATE POLICY "authenticated users can insert devices"
  ON devices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update devices"
  ON devices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- authenticated ユーザーに未登録デバイスの更新・削除を許可（承認時に使用）
CREATE POLICY "authenticated users can update unknown_devices"
  ON unknown_devices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete unknown_devices"
  ON unknown_devices FOR DELETE
  TO authenticated
  USING (true);
