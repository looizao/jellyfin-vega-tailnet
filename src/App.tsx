import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {client, safeError, stopped} from './client';
import {ActionButton} from './components/ActionButton';
import {JellyfinView} from './components/JellyfinView';
import {LoginQR} from './components/LoginQR';

export default function App() {
  const [snapshot, setSnapshot] = useState(stopped);
  const [serverUrl, setServerUrl] = useState('');
  const [hostname, setHostname] = useState(stopped.hostname);
  const [authKey, setAuthKey] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(false);
  const mounted = useRef(true);
  const active = useRef(false);

  useEffect(() => {
    mounted.current = true;
    client
      .start()
      .then(s => {
        if (!mounted.current) {
          return;
        }
        setSnapshot(s);
        setServerUrl(s.serverUrl);
        setHostname(s.hostname || stopped.hostname);
        active.current = Boolean(s.serverUrl);
      })
      .catch(e => {
        if (mounted.current) {
          setError(safeError(e));
        }
      })
      .finally(() => {
        if (mounted.current) {
          setBusy(false);
        }
      });
    let polling = false;
    const interval = setInterval(async () => {
      if (!active.current || polling) {
        return;
      }
      polling = true;
      try {
        const s = await client.status();
        if (mounted.current && active.current) {
          setSnapshot(s);
        }
      } catch (e) {
        if (mounted.current) {
          setError(safeError(e));
        }
      } finally {
        polling = false;
      }
    }, 2000);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, []);

  async function connect() {
    if (!serverUrl.trim()) {
      setError('Enter your Jellyfin server’s tailnet URL.');
      return;
    }
    setBusy(true);
    setError('');
    const key = authKey;
    setAuthKey('');
    try {
      const s = await client.start(serverUrl, hostname, key);
      if (mounted.current) {
        setSnapshot(s);
        active.current = true;
      }
    } catch (e) {
      if (mounted.current) {
        setError(safeError(e));
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  async function stop() {
    setBusy(true);
    setError('');
    active.current = false;
    try {
      await client.stop();
      setSnapshot({...stopped, serverUrl, hostname});
    } catch (e) {
      setError(safeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function open() {
    setBusy(true);
    setError('');
    try {
      await client.checkServer();
      if (mounted.current) {
        setViewing(true);
      }
    } catch (e) {
      if (mounted.current) {
        setError(safeError(e));
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  if (viewing && snapshot.webUrl) {
    return (
      <JellyfinView
        url={snapshot.webUrl}
        onSettings={() => setViewing(false)}
      />
    );
  }
  const running = snapshot.state === 'Running';
  const enrolled = snapshot.state !== 'Stopped';
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.mark}>
            <Text style={styles.markText}>JV</Text>
          </View>
          <View>
            <Text style={styles.eyebrow}>YOUR LIBRARY. YOUR TAILNET.</Text>
            <Text style={styles.title}>JellyVega</Text>
          </View>
          <View style={[styles.badge, running && styles.connected]}>
            <Text style={styles.badgeText}>
              {running ? 'Tailnet connected' : snapshot.state}
            </Text>
          </View>
        </View>
        <View style={styles.panel}>
          <Text style={styles.heading}>
            {running
              ? 'Your home cinema is connected'
              : 'Bring your home library to this TV'}
          </Text>
          <Text style={styles.help}>
            Connect to your tailnet, then sign in to Jellyfin. Your server stays
            private.
          </Text>
          <Text style={styles.label}>Jellyfin server</Text>
          <TextInput
            accessibilityLabel="Jellyfin server URL"
            value={serverUrl}
            onChangeText={setServerUrl}
            editable={!busy && !enrolled}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://nas:8096"
            placeholderTextColor="#73849e"
            style={styles.input}
          />
          {!enrolled && (
            <>
              <Text style={styles.label}>Name for this TV</Text>
              <TextInput
                accessibilityLabel="Tailscale device name"
                value={hostname}
                onChangeText={setHostname}
                editable={!busy}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <Text style={styles.label}>Tailscale auth key · optional</Text>
              <TextInput
                accessibilityLabel="Optional Tailscale auth key"
                value={authKey}
                onChangeText={setAuthKey}
                editable={!busy}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                placeholder="Leave empty to sign in with your browser"
                placeholderTextColor="#73849e"
                style={styles.input}
              />
            </>
          )}
          {snapshot.authUrl && !running && (
            <View style={styles.pairing}>
              <Text style={styles.heading}>
                Approve this TV in your browser
              </Text>
              <LoginQR url={snapshot.authUrl} />
              <Text selectable style={styles.link}>
                {snapshot.authUrl}
              </Text>
              <Text style={styles.help}>
                Open this link on your phone or computer and choose your home
                tailnet. This screen updates automatically.
              </Text>
            </View>
          )}
          {snapshot.state === 'NeedsMachineAuth' && (
            <Text style={styles.help}>
              Approve this device in the Tailscale admin console.
            </Text>
          )}
          {!!snapshot.ips.length && (
            <Text style={styles.help}>
              TV address: {snapshot.ips.join(' · ')}
            </Text>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {busy && <ActivityIndicator size="large" color="#a78bfa" />}
          <View style={styles.buttons}>
            {!enrolled && (
              <ActionButton
                label="Connect to tailnet"
                preferred
                disabled={busy}
                onPress={() => {
                  connect();
                }}
              />
            )}
            {running && (
              <ActionButton
                label="Open Jellyfin"
                preferred
                disabled={busy}
                onPress={() => {
                  open();
                }}
              />
            )}
            {enrolled && (
              <ActionButton
                label="Disconnect / change server"
                secondary
                disabled={busy}
                onPress={() => {
                  stop();
                }}
              />
            )}
          </View>
        </View>
        <Text style={styles.footer}>
          Use the directional pad in Jellyfin. Press Menu (☰) to return here.
          Home leaves the app.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#080d18'},
  page: {padding: 48, paddingHorizontal: 68},
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 30},
  mark: {
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: '#7c4dff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 24,
  },
  markText: {color: '#fff', fontSize: 34, fontWeight: '800'},
  eyebrow: {color: '#a5f3fc', letterSpacing: 3, fontSize: 14, marginBottom: 4},
  title: {fontSize: 46, color: '#f5f7ff', fontWeight: '700'},
  badge: {
    marginLeft: 'auto',
    borderRadius: 24,
    backgroundColor: '#26354e',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  connected: {backgroundColor: '#165346'},
  badgeText: {fontSize: 18, color: '#e1fff6'},
  panel: {
    padding: 32,
    borderRadius: 20,
    borderColor: '#28344a',
    borderWidth: 1,
    backgroundColor: '#111b2c',
  },
  heading: {
    fontSize: 28,
    fontWeight: '600',
    color: '#f5f7ff',
    marginBottom: 10,
  },
  help: {fontSize: 19, lineHeight: 28, color: '#b3c0d6', marginBottom: 10},
  label: {fontSize: 18, color: '#d2dcf0', marginTop: 15, marginBottom: 8},
  input: {
    fontSize: 22,
    color: '#fff',
    borderColor: '#51627d',
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#0b1320',
  },
  buttons: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 12},
  pairing: {
    backgroundColor: '#1d2b46',
    padding: 22,
    borderRadius: 14,
    marginTop: 22,
  },
  link: {fontSize: 26, color: '#a5f3fc', marginVertical: 12},
  error: {color: '#fda4af', fontSize: 20, marginTop: 20, marginBottom: 10},
  footer: {color: '#8293ad', fontSize: 17, marginTop: 22},
});
