import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {WebView} from '@amazon-devices/webview';
import {isGatewayURL} from '../client';
import {ActionButton} from './ActionButton';

export function JellyfinView({
  url,
  onSettings,
}: {
  url: string;
  onSettings: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  if (failed || !isGatewayURL(url)) {
    return (
      <View style={styles.error}>
        <Text style={styles.text}>
          Jellyfin could not load. Check your server and tailnet connection.
        </Text>
        <ActionButton
          label="Retry"
          preferred
          onPress={() => {
            setFailed(false);
            setReload(n => n + 1);
          }}
        />
        <ActionButton
          label="Connection settings"
          secondary
          onPress={onSettings}
        />
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <WebView
        key={reload}
        style={styles.root}
        hasTVPreferredFocus
        source={{uri: url}}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess={false}
        allowSystemKeyEvents
        mediaPlaybackRequiresUserAction={false}
        allowsDefaultMediaControl
        onShouldStartLoadWithRequest={request => isGatewayURL(request.url)}
        onError={() => setFailed(true)}
        onMessage={event => {
          if (event.nativeEvent.data === 'jellyvega.settings') {
            onSettings();
          }
        }}
        onCloseWindow={onSettings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#080d18'},
  error: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#080d18',
    padding: 50,
  },
  text: {color: '#ffffff', fontSize: 26, marginBottom: 24},
});
