import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {tailscaleClient} from './tailscaleClient';
import type {TailVegaSnapshot} from './types';

const initialSnapshot: TailVegaSnapshot = {
  phase: 'idle',
  backendState: 'Stopped',
  hostname: '',
  dnsName: '',
  tailnet: '',
  ips: [],
  onlinePeers: 0,
  proxy: null,
  error: null,
};

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  preferred?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
};

function ActionButton({
  label,
  onPress,
  disabled = false,
  preferred = false,
  tone = 'primary',
}: ActionButtonProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hasTVPreferredFocus={preferred}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        tone === 'secondary' && styles.buttonSecondary,
        tone === 'danger' && styles.buttonDanger,
        focused && styles.buttonFocused,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function LabelValue({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.detailValue}>
        {value || 'Unavailable'}
      </Text>
    </View>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [authKey, setAuthKey] = useState('');
  const [hostname, setHostname] = useState('fire-tv-hd');
  const [probeAddress, setProbeAddress] = useState('');
  const [probeMessage, setProbeMessage] = useState('');
  const [showProxyPassword, setShowProxyPassword] = useState(false);

  const busy = snapshot.phase === 'connecting' || snapshot.phase === 'stopping';
  const connected = snapshot.phase === 'connected';
  const statusTone = connected ? styles.statusOnline : styles.statusOffline;
  const proxyPassword = useMemo(() => {
    if (!snapshot.proxy) {
      return 'Unavailable';
    }
    return showProxyPassword ? snapshot.proxy.password : '••••••••••••••••';
  }, [showProxyPassword, snapshot.proxy]);

  useEffect(() => {
    let mounted = true;
    tailscaleClient.resume(hostname).then(result => {
      if (mounted) {
        setSnapshot(result);
      }
    });
    return () => {
      mounted = false;
    };
  }, [hostname]);

  const connect = useCallback(async () => {
    if (!authKey.trim()) {
      setSnapshot({
        ...initialSnapshot,
        phase: 'error',
        error: 'Enter a one-time auth key.',
      });
      return;
    }
    setSnapshot({...initialSnapshot, phase: 'connecting'});
    const result = await tailscaleClient.connect(
      authKey.trim(),
      hostname.trim(),
    );
    setAuthKey('');
    setSnapshot(result);
  }, [authKey, hostname]);

  const stop = useCallback(async () => {
    setSnapshot(current => ({...current, phase: 'stopping'}));
    setSnapshot(await tailscaleClient.disconnect());
    setProbeMessage('');
  }, []);

  const refresh = useCallback(async () => {
    setSnapshot(await tailscaleClient.refresh());
  }, []);

  const probe = useCallback(async () => {
    const address = probeAddress.trim();
    if (!address) {
      setProbeMessage('Enter a tailnet host and port, for example nas:22.');
      return;
    }
    setProbeMessage('Probing through the tailnet…');
    try {
      const result = await tailscaleClient.probe(address);
      setProbeMessage(`Reached ${result.address} in ${result.latencyMs} ms.`);
    } catch (error) {
      setProbeMessage(error instanceof Error ? error.message : 'Probe failed.');
    }
  }, [probeAddress]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Image
            accessibilityLabel="TailVega secure mesh icon"
            source={require('../assets/image/tailvega-icon.png')}
            style={styles.logo}
          />
          <View>
            <Text style={styles.eyebrow}>TAILSCALE FOR VEGA OS</Text>
            <Text style={styles.title}>TailVega</Text>
            <Text style={styles.subtitle}>
              Experimental userspace tailnet access for Fire TV
            </Text>
          </View>
          <View style={[styles.statusPill, statusTone]}>
            <Text style={styles.statusText}>{snapshot.backendState}</Text>
          </View>
        </View>

        {!connected ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Join your tailnet</Text>
            <Text style={styles.helpText}>
              Create a one-time, pre-authorized key in the Tailscale admin
              console. The key is passed directly to the embedded engine and
              cleared from this screen after use.
            </Text>

            <Text style={styles.inputLabel}>Device name</Text>
            <TextInput
              accessibilityLabel="Tailscale device name"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              onChangeText={setHostname}
              placeholder="fire-tv-hd"
              placeholderTextColor="#607089"
              style={styles.input}
              value={hostname}
            />

            <Text style={styles.inputLabel}>One-time auth key</Text>
            <TextInput
              accessibilityLabel="One-time Tailscale auth key"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              onChangeText={setAuthKey}
              placeholder="tskey-auth-…"
              placeholderTextColor="#607089"
              secureTextEntry
              style={styles.input}
              value={authKey}
            />

            {snapshot.error ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {snapshot.error}
              </Text>
            ) : null}

            <View style={styles.actionRow}>
              <ActionButton
                disabled={busy}
                label={busy ? 'Connecting…' : 'Connect'}
                onPress={connect}
                preferred
              />
              {busy ? <ActivityIndicator color="#62e6d8" size="large" /> : null}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              <View style={[styles.panel, styles.gridPanel]}>
                <Text style={styles.panelTitle}>Node</Text>
                <LabelValue label="Host" value={snapshot.hostname} />
                <LabelValue label="MagicDNS" value={snapshot.dnsName} />
                <LabelValue label="Tailnet" value={snapshot.tailnet} />
                <LabelValue label="Addresses" value={snapshot.ips.join(', ')} />
                <LabelValue
                  label="Online peers"
                  value={String(snapshot.onlinePeers)}
                />
              </View>

              <View style={[styles.panel, styles.gridPanel]}>
                <Text style={styles.panelTitle}>Local SOCKS5 endpoint</Text>
                <LabelValue
                  label="Address"
                  value={snapshot.proxy?.address ?? ''}
                />
                <LabelValue
                  label="Username"
                  value={snapshot.proxy?.username ?? ''}
                />
                <LabelValue label="Password" value={proxyPassword} />
                <ActionButton
                  label={
                    showProxyPassword ? 'Hide password' : 'Reveal password'
                  }
                  onPress={() => setShowProxyPassword(value => !value)}
                  tone="secondary"
                />
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Test a tailnet service</Text>
              <Text style={styles.helpText}>
                Enter a MagicDNS name or Tailscale IP with a TCP port.
              </Text>
              <View style={styles.probeRow}>
                <TextInput
                  accessibilityLabel="Tailnet host and port"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setProbeAddress}
                  placeholder="nas:22 or 100.64.0.10:443"
                  placeholderTextColor="#607089"
                  style={[styles.input, styles.probeInput]}
                  value={probeAddress}
                />
                <ActionButton label="Probe" onPress={probe} />
              </View>
              {probeMessage ? (
                <Text style={styles.probeMessage}>{probeMessage}</Text>
              ) : null}
            </View>

            <View style={styles.actionRow}>
              <ActionButton
                label="Refresh"
                onPress={refresh}
                tone="secondary"
              />
              <ActionButton label="Stop" onPress={stop} tone="danger" />
            </View>
          </>
        )}

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Vega OS limitation</Text>
          <Text style={styles.noticeText}>
            Vega does not currently expose a public VPN or TUN API. TailVega
            joins the tailnet in userspace and can dial tailnet services, but it
            cannot route all Fire TV apps or act as a device-wide exit-node
            client.
          </Text>
        </View>

        <Text style={styles.footer}>{tailscaleClient.engineVersion()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#07111f'},
  page: {paddingHorizontal: 64, paddingVertical: 42, gap: 24},
  header: {alignItems: 'center', flexDirection: 'row', gap: 22},
  logo: {borderRadius: 24, height: 92, width: 92},
  eyebrow: {
    color: '#62e6d8',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2.4,
  },
  title: {color: '#f4f8ff', fontSize: 42, fontWeight: '800', letterSpacing: -1},
  subtitle: {color: '#a9b8cc', fontSize: 18, marginTop: 2},
  statusPill: {
    borderRadius: 18,
    marginLeft: 'auto',
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  statusOnline: {backgroundColor: '#0b685f'},
  statusOffline: {backgroundColor: '#28364a'},
  statusText: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  panel: {
    backgroundColor: '#101e30',
    borderColor: '#263a52',
    borderRadius: 20,
    borderWidth: 1,
    padding: 26,
  },
  panelTitle: {
    color: '#f4f8ff',
    fontSize: 25,
    fontWeight: '700',
    marginBottom: 12,
  },
  helpText: {
    color: '#a9b8cc',
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 18,
    maxWidth: 920,
  },
  inputLabel: {
    color: '#d6e0ed',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 7,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#071422',
    borderColor: '#35506c',
    borderRadius: 12,
    borderWidth: 2,
    color: '#f4f8ff',
    fontSize: 19,
    paddingHorizontal: 17,
    paddingVertical: 13,
  },
  errorText: {color: '#ff9c9c', fontSize: 16, marginTop: 14},
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    marginTop: 18,
  },
  button: {
    backgroundColor: '#168c80',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 3,
    minWidth: 150,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  buttonSecondary: {backgroundColor: '#263a52'},
  buttonDanger: {backgroundColor: '#7a3041'},
  buttonFocused: {borderColor: '#ffffff', transform: [{scale: 1.04}]},
  buttonPressed: {opacity: 0.82},
  buttonDisabled: {opacity: 0.45},
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  grid: {flexDirection: 'row', gap: 24},
  gridPanel: {flex: 1},
  detailRow: {
    borderBottomColor: '#263a52',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 10,
  },
  detailLabel: {color: '#8fa2b9', fontSize: 15, width: 118},
  detailValue: {color: '#e8f0fa', flex: 1, fontSize: 16, fontWeight: '600'},
  probeRow: {alignItems: 'center', flexDirection: 'row', gap: 16},
  probeInput: {flex: 1},
  probeMessage: {color: '#8ff4e8', fontSize: 16, marginTop: 14},
  notice: {
    backgroundColor: '#2a2518',
    borderColor: '#65552a',
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  noticeTitle: {
    color: '#ffe199',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 5,
  },
  noticeText: {color: '#d8cda9', fontSize: 15, lineHeight: 22},
  footer: {color: '#607089', fontSize: 13, textAlign: 'right'},
});
