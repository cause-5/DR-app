import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Markdown from 'react-native-markdown-display';

import { analyzeImage, chatWithAssistant } from '../services/api';

const { width } = Dimensions.get('window');

const SEVERITY_LEVELS = [
  { label: 'No DR',          risk: 'No Risk',       color: '#10B981', summary: 'No obvious diabetic retinopathy patterns detected.' },
  { label: 'Mild',           risk: 'Low Risk',       color: '#84CC16', summary: 'Small early abnormalities may be present. Follow-up is recommended.' },
  { label: 'Moderate',       risk: 'Moderate Risk',  color: '#FACC15', summary: 'Moderate DR risk. Clinical review is recommended.' },
  { label: 'Severe',         risk: 'High Risk',      color: '#F97316', summary: 'High DR risk. Please consult an eye specialist promptly.' },
  { label: 'Proliferative',  risk: 'Critical Risk',  color: '#EF4444', summary: 'Very high DR risk. Urgent ophthalmology follow-up is advised.' },
];

const LOADING_MESSAGES = [
  'Analyzing retinal vessels...',
  'Detecting lesions...',
  'Evaluating severity...',
  'Generating report... ',
];

// ── Scanning animation overlay ────────────────────────────────────────────────
function ScanOverlay() {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const msgIndex = useRef(new Animated.Value(0)).current;
  const [msgI, setMsgI] = useState(0);

  useEffect(() => {
    const scanLoop = Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 1800, useNativeDriver: true })
    );
    scanLoop.start();

    const msgTimer = setInterval(() => {
      setMsgI(i => (i + 1) % LOADING_MESSAGES.length);
    }, 1500);

    return () => { scanLoop.stop(); clearInterval(msgTimer); };
  }, []);

  const translateY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });

  return (
    <View style={scanStyles.overlay}>
      <Animated.View style={[scanStyles.beam, { transform: [{ translateY }] }]}>
        <LinearGradient
          colors={['rgba(79,123,255,0)', 'rgba(79,123,255,0.6)', 'rgba(79,123,255,0)']}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <Text style={scanStyles.message}>{LOADING_MESSAGES[msgI]}</Text>
    </View>
  );
}

const scanStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,5,10,0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
    overflow: 'hidden',
  },
  beam: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  message: {
    color: '#4F7BFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

// ── Animated confidence counter ───────────────────────────────────────────────
function ConfidenceCounter({ target }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(start);
    }, 30);
    return () => clearInterval(timer);
  }, [target]);
  return <Text style={resultStyles.confidenceValue}>{value}%</Text>;
}

// ── Severity bar with animated indicator ─────────────────────────────────────
function SeverityBar({ grade }) {
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: grade / 4,
      friction: 5,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [grade]);

  const leftPct = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '96%'],
  });

  return (
    <View style={resultStyles.barContainer}>
      <LinearGradient
        colors={['#10B981', '#84CC16', '#FACC15', '#F97316', '#EF4444']}
        start={[0, 0]} end={[1, 0]}
        style={resultStyles.barTrack}
      />
      <Animated.View style={[resultStyles.barIndicator, { left: leftPct }]} />
      <View style={resultStyles.barLabels}>
        {['None', 'Mild', 'Mod', 'Severe', 'Prolif'].map((l, i) => (
          <Text key={i} style={resultStyles.barLabel}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

// ── Expandable section ────────────────────────────────────────────────────────
function ExpandableSection({ title, icon, children, accentColor = '#4F7BFF' }) {
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toVal = expanded ? 0 : 1;
    Animated.parallel([
      Animated.spring(heightAnim, { toValue: toVal, useNativeDriver: false, friction: 8 }),
      Animated.timing(rotateAnim, { toValue: toVal, duration: 250, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: toVal, duration: 300, useNativeDriver: true }),
    ]).start();
    setExpanded(!expanded);
  };

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const maxHeight = heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 600] });

  return (
    <View style={expStyles.container}>
      <TouchableOpacity style={expStyles.header} onPress={toggle} activeOpacity={0.75}>
        <View style={[expStyles.iconBadge, { backgroundColor: accentColor + '22' }]}>
          <Ionicons name={icon} size={18} color={accentColor} />
        </View>
        <Text style={expStyles.title}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.4)" />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
        <Animated.View style={{ opacity: opacityAnim, padding: 16, paddingTop: 4 }}>
          {children}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const expStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

const resultStyles = StyleSheet.create({
  barContainer: { width: '100%', marginBottom: 8 },
  barTrack: { height: 10, borderRadius: 5, marginBottom: 6 },
  barIndicator: {
    position: 'absolute',
    top: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  barLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10 },
  confidenceValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
});

// ── Chatbot FAB (Feature Coming Soon) ────────────────────────────────────────
function ChatbotFAB({ onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (onPress) onPress();
  };

  return (
    <View style={fabStyles.wrapper}>
      <Animated.View style={{ transform: [{ scale: Animated.multiply(scaleAnim, breatheAnim) }] }}>
        <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={fabStyles.touchable}>
          <LinearGradient colors={['#4F7BFF', '#8B5CF6', '#D946EF']} start={[0, 0]} end={[1, 1]} style={fabStyles.fab}>
            <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const fabStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    alignItems: 'flex-end',
    zIndex: 999,
  },
  touchable: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    backgroundColor: 'rgba(20,20,35,0.95)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

function ChatModal({ visible, onClose }) {
  const [messages, setMessages] = useState([{ id: '1', text: "Hi! I'm your AI assistant. How can I help you understand diabetic retinopathy?", isUser: false }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  const SUGGESTIONS = [
    "What are some advanced treatment methods?",
    "Where in Waterloo can I visit for this?",
    "Who is more at risk?",
    "What factors lead to this development?",
    "How does this AI detect DR?",
    "What lifestyle habits prevent/help with this?"
  ];

  const sendMessage = async (overrideText = null) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : input;
    if (!textToSend.trim()) return;
    
    const userMsg = { id: Date.now().toString(), text: textToSend.trim(), isUser: true };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await chatWithAssistant(userMsg.text);
      setMessages(prev => [...prev, { id: Date.now().toString(), text: data.answer || "Sorry, I couldn't process that.", isUser: false }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now().toString(), text: "Error connecting to AI.", isUser: false }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={chatStyles.modalOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={chatStyles.modalContent}
        >
          <View style={chatStyles.header}>
            <Text style={chatStyles.headerTitle}>AI Assistant</Text>
            <TouchableOpacity onPress={onClose} style={chatStyles.closeButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={chatStyles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View style={[chatStyles.bubbleWrapper, item.isUser ? chatStyles.userBubbleWrapper : chatStyles.aiBubbleWrapper]}>
                <View style={[chatStyles.bubble, item.isUser ? chatStyles.userBubble : chatStyles.aiBubble]}>
                  {item.isUser ? (
                    <Text style={chatStyles.messageText}>{item.text}</Text>
                  ) : (
                    <Markdown style={markdownStyles}>{item.text}</Markdown>
                  )}
                </View>
              </View>
            )}
          />

          <View style={chatStyles.inputContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={chatStyles.suggestionsScroll} contentContainerStyle={chatStyles.suggestionsContainer}>
              {SUGGESTIONS.map((q, idx) => (
                <TouchableOpacity key={idx} onPress={() => sendMessage(q)} disabled={loading}>
                  <LinearGradient
                    colors={['rgba(79,123,255,0.5)', 'rgba(217,70,239,0.5)', 'rgba(255,255,255,0.15)']}
                    start={[0, 0]} end={[1, 1]}
                    style={chatStyles.suggestionChip}
                  >
                    <Text style={chatStyles.suggestionText}>{q}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <LinearGradient
              colors={['#4F7BFF', '#8B5CF6', '#D946EF']}
              start={[0, 0]} end={[1, 0]}
              style={chatStyles.gradientLine}
            />
            <View style={chatStyles.inputRow}>
              <TextInput
                style={chatStyles.textInput}
                placeholder="type question here…"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={input}
                onChangeText={setInput}
                multiline
              />
              <TouchableOpacity onPress={sendMessage} disabled={loading || !input.trim()} style={chatStyles.sendBtnContainer}>
                <LinearGradient
                  colors={['#4F7BFF', '#8B5CF6', '#D946EF']}
                  start={[0, 0]} end={[1, 1]}
                  style={chatStyles.sendBtn}
                >
                  {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="send" size={16} color="#FFF" />}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const chatStyles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    height: '60%',
    backgroundColor: '#0A0C14',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  closeButton: { position: 'absolute', right: 16 },
  messageList: { padding: 16, paddingBottom: 24 },
  bubbleWrapper: { marginBottom: 12, flexDirection: 'row' },
  userBubbleWrapper: { justifyContent: 'flex-end' },
  aiBubbleWrapper: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  userBubble: { backgroundColor: 'rgba(255,255,255,0.1)', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#4F7BFF', borderBottomLeftRadius: 4 },
  messageText: { color: '#FFF', fontSize: 14, lineHeight: 20 },
  inputContainer: { backgroundColor: '#0D1025', paddingBottom: Platform.OS === 'ios' ? 24 : 16 },
  suggestionsScroll: { maxHeight: 50, marginBottom: 12, marginTop: 4 },
  suggestionsContainer: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  suggestionChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 8,
  },
  suggestionText: { color: '#FFF', fontSize: 13, fontWeight: '500' },
  gradientLine: { height: 2, width: '100%' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  textInput: {
    flex: 1, color: '#FFF', fontSize: 15, maxHeight: 100, minHeight: 40,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 10, marginRight: 12,
  },
  sendBtnContainer: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  sendBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingLeft: 2 },
});

const markdownStyles = {
  body: { color: '#FFF', fontSize: 14, lineHeight: 22 },
  heading1: { fontSize: 18, fontWeight: '700', marginTop: 10, marginBottom: 5, color: '#FFF' },
  heading2: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 4, color: '#FFF' },
  heading3: { fontSize: 15, fontWeight: '600', marginTop: 8, marginBottom: 4, color: '#FFF' },
  strong: { fontWeight: '700', color: '#FFF' },
  em: { fontStyle: 'italic', color: '#FFF' },
  list_item: { marginVertical: 4, color: '#FFF' },
  bullet_list: { marginBottom: 10 },
  ordered_list: { marginBottom: 10 },
  code_inline: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 4, borderRadius: 4, fontFamily: 'monospace' },
  code_block: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 8, fontFamily: 'monospace', marginVertical: 8, color: '#FFF' },
  link: { color: '#8B5CF6', textDecorationLine: 'underline' },
  paragraph: { marginVertical: 4 },
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DetectionScreen() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultTranslate = useRef(new Animated.Value(20)).current;

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (!res.canceled && res.assets[0]) {
      setImage(res.assets[0].uri);
      handleAnalyze(res.assets[0].uri);
    }
  };

  const handleAnalyze = async (uri) => {
    setLoading(true);
    setResult(null);
    resultOpacity.setValue(0);
    resultTranslate.setValue(20);
    try {
      const response = await analyzeImage(uri);
      setResult(response);
      Animated.parallel([
        Animated.timing(resultOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(resultTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    } catch {
      alert('Analysis failed. Make sure the backend is running and the image is valid.');
    } finally {
      setLoading(false);
    }
  };

  const prediction = result?.prediction;
  const severity = prediction ? SEVERITY_LEVELS[prediction.grade] : null;
  const confidence = prediction ? Math.round(prediction.confidence * 100) : 0;

  return (
    <View style={s.container}>
      <LinearGradient colors={['#04050A', '#080C18', '#0D1025']} style={StyleSheet.absoluteFillObject} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>DR Detection</Text>
          <Text style={s.headerSub}>Upload a retinal fundus image</Text>
        </View>

        {/* ── Tutorial Button ── */}
        <TouchableOpacity onPress={() => setShowTutorial(true)} activeOpacity={0.8} style={s.tutorialBtn}>
          <LinearGradient colors={['#4F7BFF', '#8B5CF6']} start={[0, 0]} end={[1, 0]} style={s.tutorialGrad}>
            <Ionicons name="play-circle" size={22} color="#fff" />
            <Text style={s.tutorialText}>How to Capture a Retinal Image</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Upload Box ── */}
        <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={s.uploadBox}>
          <LinearGradient
            colors={['rgba(79,123,255,0.1)', 'rgba(139,92,246,0.06)']}
            style={StyleSheet.absoluteFillObject}
          />
          {image ? (
            <>
              <Image source={{ uri: image }} style={s.previewImage} blurRadius={loading ? 6 : 0} />
              {loading && <ScanOverlay />}
            </>
          ) : (
            <View style={s.uploadPlaceholder}>
              <LinearGradient colors={['#4F7BFF22', '#8B5CF622']} style={s.uploadIconCircle}>
                <Ionicons name="cloud-upload-outline" size={36} color="#4F7BFF" />
              </LinearGradient>
              <Text style={s.uploadTitle}>Upload Fundus Image</Text>
              <Text style={s.uploadSub}>Tap anywhere or drag an image here</Text>
              <View style={s.uploadBadge}>
                <Text style={s.uploadBadgeText}>JPG · PNG · WEBP</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Results ── */}
        {result && prediction && severity && (
          <Animated.View style={{ opacity: resultOpacity, transform: [{ translateY: resultTranslate }] }}>

            {/* Severity Card */}
            <View style={s.resultCard}>
              <LinearGradient
                colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={s.resultCardLabel}>Detection Result</Text>

              <View style={s.severityRow}>
                <Text style={[s.severityNumber, { color: severity.color }]}>{prediction.grade}</Text>
                <View style={s.severityBadge}>
                  <Text style={[s.severityRisk, { color: severity.color }]}>{severity.risk}</Text>
                  <Text style={s.severityName}>{severity.label}</Text>
                </View>
              </View>

              <SeverityBar grade={prediction.grade} />

              <Text style={s.summarySentence}>{severity.summary}</Text>

              {/* Confidence */}
              <View style={s.confidenceRow}>
                <Text style={s.confidenceLabel}>AI Confidence</Text>
                {result && <ConfidenceCounter target={confidence} />}
              </View>
            </View>

            {/* Expandable: Image Quality */}
            {result.quality && (result.quality.issues?.length > 0 || result.quality.recommendations?.length > 0) && (
              <ExpandableSection title="How to improve pic?" icon="camera-outline" accentColor="#10B981">
                <Text style={s.expandText}>
                  {result.quality.issues && result.quality.issues.length > 0 && (
                    <>
                      <Text style={s.bold}>Issues Detected:{'\n'}</Text>
                      {result.quality.issues.map((iss) => `• ${iss}\n`).join('')}
                      {'\n'}
                    </>
                  )}
                  {result.quality.recommendations && result.quality.recommendations.length > 0 && (
                    <>
                      <Text style={s.bold}>Recommendations:{'\n'}</Text>
                      {result.quality.recommendations.map((rec) => `• ${rec}\n`).join('')}
                    </>
                  )}
                </Text>
              </ExpandableSection>
            )}

            {/* Expandable: AI Explanation */}
            <ExpandableSection title="AI Explanation" icon="sparkles" accentColor="#8B5CF6">
              <Text style={s.expandText}>
                <Text style={s.bold}>Severity Level {prediction.grade}</Text> — {severity.label}{'\n\n'}
                {severity.summary}{'\n\n'}
                <Text style={s.bold}>Likely Retinal Findings:</Text> Based on the image analysis, the model has identified patterns consistent with Grade {prediction.grade} diabetic retinopathy.{'\n\n'}
                <Text style={s.bold}>Suggested Next Steps:</Text>{' '}
                {prediction.grade === 0
                  ? 'Retest during routine annual screening.'
                  : prediction.grade <= 2
                  ? 'Please arrange a follow-up eye exam with your ophthalmologist.'
                  : 'Seek ophthalmology review as soon as possible. Do not delay.'}
              </Text>
            </ExpandableSection>

            {/* Expandable: DR Information */}
            <ExpandableSection title="About Diabetic Retinopathy" icon="eye-outline" accentColor="#4F7BFF">
              <Text style={s.expandText}>
                <Text style={s.bold}>What is Diabetic Retinopathy?{'\n'}</Text>
                DR is a diabetes complication damaging retinal blood vessels. It can cause blindness if untreated.{'\n\n'}
                <Text style={s.bold}>How Diabetes Affects the Retina{'\n'}</Text>
                High blood sugar weakens and leaks retinal vessels. New fragile vessels grow and may bleed.{'\n\n'}
                <Text style={s.bold}>Why Early Detection Matters{'\n'}</Text>
                Early DR has no symptoms. Screening catches it before vision loss, giving time for effective treatment.{'\n\n'}
                <Text style={s.bold}>Available Treatments{'\n'}</Text>
                Laser treatment, anti-VEGF injections, and vitrectomy surgery can halt or reverse progression.{'\n\n'}
                <Text style={s.bold}>Vision Can Often Be Preserved{'\n'}</Text>
                With timely intervention, 90% of vision loss from DR can be prevented.
              </Text>
            </ExpandableSection>

            {/* Disclaimer */}
            <View style={s.disclaimerBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color="rgba(255,255,255,0.3)" />
              <Text style={s.disclaimerText}>
                This AI tool is intended for early screening only and is not a medical diagnosis. Always consult a qualified healthcare professional.
              </Text>
            </View>

          </Animated.View>

        )}

        {/* Quality reject */}
        {result && !result.can_analyze && (
          <View style={s.errorCard}>
            <Ionicons name="warning" size={28} color="#F59E0B" />
            <Text style={s.errorText}>{result.message}</Text>
          </View>
        )}

        <View style={{ height: 120 }} />

                {/* ── FAQ ── woking */}
      <Text style={s.headerSub}>Frequently Asked Questions</Text>

      <ExpandableSection
        title="What is Diabetic Retinopathy (DR)?"
        icon="help-circle-outline"
        accentColor="#4F7BFF"
      >
        <Text style={s.expandText}>
          Diabetic retinopathy (DR) is an eye disease caused by diabetes that damages
          the tiny blood vessels in the retina. In its early stages it often has no
          symptoms, but if left untreated it can lead to permanent vision loss or
          blindness. Fortunately, early detection and treatment can prevent most
          vision loss.
        </Text>
      </ExpandableSection>

      <ExpandableSection
        title="Who is at risk of DR?"
        icon="people-outline"
        accentColor="#8B5CF6"
      >
        <Text style={s.expandText}>
          Anyone with <Text style={s.bold}>Type 1</Text> or <Text style={s.bold}>Type 2 diabetes</Text>
          can develop diabetic retinopathy. Your risk increases if you:
          {"\n\n"}• Have had diabetes for many years
          {"\n"}• Have poorly controlled blood sugar
          {"\n"}• Have high blood pressure or high cholesterol
          {"\n"}• Are pregnant while living with diabetes
          {"\n"}• Miss regular diabetic eye examinations
        </Text>
      </ExpandableSection>

      <ExpandableSection
        title="What should I do next?"
        icon="medical-outline"
        accentColor="#F97316"
      >
        <Text style={s.expandText}>
          If your screening result shows <Text style={s.bold}>anything above "No DR"</Text>,
          you should consult a healthcare professional.
          {"\n\n"}
          Start by visiting an <Text style={s.bold}>optometrist as soon as possible.</Text>
          They can perform a comprehensive eye examination and determine whether
          additional care is needed.
          {"\n\n"}
          You should also inform your <Text style={s.bold}>family doctor</Text> or the
          <Text style={s.bold}> endocrinologist managing your diabetes</Text>.
          {"\n\n"}
          If your result suggests severe disease, you may eventually need to see an
          <Text style={s.bold}> ophthalmologist</Text> or
          <Text style={s.bold}> retina specialist</Text>. In most cases these specialists
          require a referral from an optometrist first, who will guide you through
          the appropriate next steps.
        </Text>
      </ExpandableSection>

      <ExpandableSection
        title="Where can I receive care in the Waterloo Region?"
        icon="location-outline"
        accentColor="#10B981"
      >
        <Text style={s.expandText}>
          A good place to begin is with one of these local optometry clinics:
          {"\n\n"}
          • Waterloo Eye Institute
          {"\n"}
          • Waterloo Vision Care Clinic
          {"\n"}
          • Waterloo Eye Care Centre
          {"\n\n"}
          These clinics can perform a comprehensive diabetic eye examination and
          provide referrals if specialist care is required.
          {"\n\n"}
          If you require advanced retinal treatment, providers include:
          {"\n\n"}
          • Dr. Chryssa McAlister
          {"\n"}
          • Ocular Health Centre
          {"\n"}
          • Waterloo Region Retina Institute (Dr. Carl Shen)
        </Text>
      </ExpandableSection>
      </ScrollView>


      {/* Tutorial Modal */}
      <Modal visible={showTutorial} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>How to Capture a Retinal Image</Text>
          <TouchableOpacity onPress={() => setShowTutorial(false)}>
            <Text style={s.modalClose}>Done</Text>
          </TouchableOpacity>
        </View>
        <WebView source={{ uri: 'https://youtu.be/Nu6cx1iyhVM?si=9-woZckgXQZ5c1Pk&t=73' }} style={{ flex: 1 }} />
      </Modal>

      {/* Chatbot FAB */}
      <ChatbotFAB onPress={() => setChatVisible(true)} />
      
      {/* Chat Modal */}
      <ChatModal visible={chatVisible} onClose={() => setChatVisible(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04050A' },
  scroll: { padding: 20, paddingTop: 16 },

  // Header
  header: { marginBottom: 24, marginTop: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 4 },

  // Tutorial
  tutorialBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#4F7BFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  tutorialGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  tutorialText: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 14 },

  // Upload
  uploadBox: {
    height: 240,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(79,123,255,0.3)',
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadPlaceholder: { alignItems: 'center', gap: 12 },
  uploadIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  uploadSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  uploadBadge: {
    backgroundColor: 'rgba(79,123,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(79,123,255,0.3)',
  },
  uploadBadgeText: { color: '#4F7BFF', fontSize: 11, fontWeight: '600' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },

  // Result card
  resultCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
    marginBottom: 16,
    overflow: 'hidden',
  },
  resultCardLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  severityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 16 },
  severityNumber: { fontSize: 80, fontWeight: '900', lineHeight: 84, letterSpacing: -2 },
  severityBadge: { flex: 1 },
  severityRisk: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  severityName: { fontSize: 15, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  summarySentence: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 16,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 16,
    marginTop: 8,
  },
  confidenceLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '500' },

  // Expandable text
  expandText: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 24 },
  bold: { color: '#FFFFFF', fontWeight: '700' },

  // Disclaimer
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  disclaimerText: {
    flex: 1,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    lineHeight: 18,
  },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  errorText: { flex: 1, color: '#F59E0B', fontSize: 14, fontWeight: '500', lineHeight: 20 },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0D1025',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  modalClose: { fontSize: 16, color: '#4F7BFF', fontWeight: '600' },
});
