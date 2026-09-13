import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import qrcode from 'qrcode-generator';

// Draw contiguous runs, avoiding a separate native view per QR module.
export function LoginQR({url}: {url: string}) {
  const rows = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(url);
    code.make();
    const count = code.getModuleCount();
    return Array.from({length: count}, (_, y) => {
      const runs: Array<{dark: boolean; width: number}> = [];
      for (let x = 0; x < count; x++) {
        const dark = code.isDark(y, x);
        const previous = runs[runs.length - 1];
        if (previous?.dark === dark) {
          previous.width++;
        } else {
          runs.push({dark, width: 1});
        }
      }
      return runs;
    });
  }, [url]);
  const unit = Math.min(5, 240 / (rows.length + 8));
  return (
    <View
      accessibilityLabel="Scan to approve this TV in Tailscale"
      style={[styles.quietZone, {padding: 4 * unit}]}>
      {rows.map((row, y) => (
        <View key={y} style={[styles.row, {height: unit}]}>
          {row.map((run, x) => (
            <View
              key={x}
              style={[
                {width: run.width * unit, height: unit},
                run.dark ? styles.dark : styles.light,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  dark: {backgroundColor: '#000000'},
  light: {backgroundColor: '#ffffff'},
  quietZone: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    marginVertical: 12,
  },
  row: {flexDirection: 'row'},
});
