import React, { useEffect, useState, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const TRANSACTIONS_KEY = '@ledger_transactions';
const CUSTOMERS_KEY = '@ledger_customers';
const INVENTORY_KEY = '@ledger_inventory';
const MOVEMENTS_KEY = '@ledger_inventory_movements';
const API_KEY_STORAGE = '@claude_api_key';

function formatAmount(n) {
  return Number(n || 0).toLocaleString('ko-KR') + '원';
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [apiKey, setApiKey] = useState('');

  // 모달 가시성
  const [addTxVisible, setAddTxVisible] = useState(false);
  const [txDetailVisible, setTxDetailVisible] = useState(false);
  const [addCustomerVisible, setAddCustomerVisible] = useState(false);
  const [addInvVisible, setAddInvVisible] = useState(false);
  const [invDetailVisible, setInvDetailVisible] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedInv, setSelectedInv] = useState(null);

  // 거래 입력 폼
  const [txType, setTxType] = useState('매출');
  const [txImage, setTxImage] = useState(null);
  const [txAmount, setTxAmount] = useState('');
  const [txPaidAmount, setTxPaidAmount] = useState('');
  const [txDate, setTxDate] = useState(todayStr());
  const [txCustomerId, setTxCustomerId] = useState('');
  const [txNote, setTxNote] = useState('');

  // AI OCR
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  // 거래처 폼
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custNote, setCustNote] = useState('');

  // 재고 폼
  const [invName, setInvName] = useState('');
  const [invUnit, setInvUnit] = useState('개');
  const [invCostPrice, setInvCostPrice] = useState('');
  const [invSellingPrice, setInvSellingPrice] = useState('');
  const [invMinQty, setInvMinQty] = useState('5');
  const [invNote, setInvNote] = useState('');

  // 재고 조정
  const [adjType, setAdjType] = useState('입고');
  const [adjQty, setAdjQty] = useState('');
  const [adjNote, setAdjNote] = useState('');

  // 거래 필터 / 결제 입력
  const [txFilter, setTxFilter] = useState('전체');
  const [payInput, setPayInput] = useState('');

  // SMS 가져오기
  const [smsImportVisible, setSmsImportVisible] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [parsedSms, setParsedSms] = useState(null);

  // API 키 입력
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => { loadData(); }, []);

  // ─── 데이터 로드/저장 ─────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      console.log('[INFO] 데이터 불러오기 시작');
      const [txRaw, custRaw, invRaw, movRaw, keyRaw] = await Promise.all([
        AsyncStorage.getItem(TRANSACTIONS_KEY),
        AsyncStorage.getItem(CUSTOMERS_KEY),
        AsyncStorage.getItem(INVENTORY_KEY),
        AsyncStorage.getItem(MOVEMENTS_KEY),
        AsyncStorage.getItem(API_KEY_STORAGE),
      ]);
      if (txRaw) setTransactions(JSON.parse(txRaw));
      if (custRaw) setCustomers(JSON.parse(custRaw));
      if (invRaw) setInventory(JSON.parse(invRaw));
      if (movRaw) setMovements(JSON.parse(movRaw));
      if (keyRaw) setApiKey(keyRaw);
      console.log('[INFO] 데이터 불러오기 완료');
    } catch (e) {
      console.error('[ERROR] 데이터 불러오기 실패', e);
    }
  };

  const saveTransactions = async (list) => {
    try {
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(list));
      setTransactions(list);
    } catch (e) { console.error('[ERROR] 거래 저장 실패', e); }
  };

  const saveCustomers = async (list) => {
    try {
      await AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list));
      setCustomers(list);
    } catch (e) { console.error('[ERROR] 거래처 저장 실패', e); }
  };

  const saveInventory = async (list) => {
    try {
      await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(list));
      setInventory(list);
    } catch (e) { console.error('[ERROR] 재고 저장 실패', e); }
  };

  const saveMovements = async (list) => {
    try {
      await AsyncStorage.setItem(MOVEMENTS_KEY, JSON.stringify(list));
      setMovements(list);
    } catch (e) { console.error('[ERROR] 재고 이동 저장 실패', e); }
  };

  // ─── SMS 파싱 ─────────────────────────────────────────────────────────────

  const parseSmsText = (text) => {
    console.log('[INFO] SMS 파싱 시작');
    const result = { type: null, amount: null, date: todayStr(), note: '' };

    const amountMatch = text.match(/([0-9]{1,3}(?:,[0-9]{3})*)\s*원/);
    if (amountMatch) result.amount = parseInt(amountMatch[1].replace(/,/g, ''), 10);

    const now = new Date();
    const dateMatch = text.match(/(\d{1,2})[\/월](\d{1,2})/);
    if (dateMatch) {
      result.date = `${now.getFullYear()}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
    }

    if (/입금|수신|받음/.test(text)) {
      result.type = '매출';
    } else {
      result.type = '매입';
    }

    const merchantMatch = text.match(/\d{1,2}:\d{2}\s+([가-힣A-Za-z0-9·&]+)\s+[0-9,]+원/);
    const transferMatch = text.match(/([가-힣A-Za-z0-9]+)(에게|에서)/);
    const bankMatch = text.match(/\[([^\]]+)\]/);
    if (merchantMatch) result.note = merchantMatch[1].trim();
    else if (transferMatch) result.note = transferMatch[1].trim();
    else if (bankMatch) result.note = bankMatch[1].trim();
    else result.note = text.replace(/\s+/g, ' ').trim().substring(0, 30);

    console.log('[INFO] SMS 파싱 완료', result);
    setParsedSms(result);
  };

  // ─── AI 이미지 분석 ───────────────────────────────────────────────────────

  const imageToBase64 = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const [header, data] = reader.result.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        resolve({ base64: data, mediaType: mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const analyzeImage = async () => {
    if (!txImage) return;
    if (!apiKey) {
      Alert.alert(
        'API 키 필요',
        'AI 분석 기능을 사용하려면 Claude API 키를 설정해주세요.\n(anthropic.com에서 발급)',
        [
          { text: '설정하기', onPress: () => { setAddTxVisible(false); setApiKeyModalVisible(true); } },
          { text: '취소', style: 'cancel' },
        ]
      );
      return;
    }

    setIsAnalyzing(true);
    setOcrResult(null);
    console.log('[INFO] AI 이미지 분석 시작');

    try {
      const { base64, mediaType } = await imageToBase64(txImage);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              {
                type: 'text',
                text: '이 영수증/청구서/이체내역 이미지에서 정보를 추출해주세요.\n반드시 JSON만 반환하세요:\n{"amount": 금액숫자, "date": "YYYY-MM-DD 또는 null", "merchant": "상호명 또는 null", "type": "매입 또는 매출"}\n매입=지출/구매/결제, 매출=수입/입금/판매대금',
              },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      console.log('[DEBUG] Claude OCR 응답:', text);

      let parsed = null;
      try { parsed = JSON.parse(text); }
      catch {
        const m = text.match(/\{[\s\S]*?\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
      }

      if (parsed?.amount) {
        setOcrResult(parsed);
        console.log('[INFO] AI 분석 완료', parsed);
      } else {
        Alert.alert('인식 실패', '이미지에서 정보를 추출하지 못했습니다. 직접 입력해주세요.');
      }
    } catch (e) {
      console.error('[ERROR] AI 분석 실패', e);
      Alert.alert('분석 실패', e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyOcrResult = () => {
    if (!ocrResult) return;
    if (ocrResult.type) setTxType(ocrResult.type);
    if (ocrResult.amount) setTxAmount(String(ocrResult.amount));
    if (ocrResult.date) setTxDate(ocrResult.date);
    if (ocrResult.merchant) setTxNote(ocrResult.merchant);
    setOcrResult(null);
    console.log('[INFO] OCR 결과 거래 폼에 적용', ocrResult);
  };

  // ─── 이미지 선택 ──────────────────────────────────────────────────────────

  const pickImage = async (useCamera) => {
    try {
      let result;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('권한 필요', '카메라 권한을 허용해 주세요.'); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('권한 필요', '갤러리 권한을 허용해 주세요.'); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      }
      if (!result.canceled) {
        setTxImage(result.assets[0].uri);
        setOcrResult(null);
        console.log('[INFO] 이미지 선택 완료', result.assets[0].uri);
      }
    } catch (e) { console.error('[ERROR] 이미지 선택 실패', e); }
  };

  // ─── 거래 CRUD ────────────────────────────────────────────────────────────

  const openAddTx = () => {
    setTxType('매출');
    setTxImage(null);
    setTxAmount('');
    setTxPaidAmount('');
    setTxDate(todayStr());
    setTxCustomerId('');
    setTxNote('');
    setOcrResult(null);
    setIsAnalyzing(false);
    setAddTxVisible(true);
  };

  const submitTransaction = () => {
    const amt = parseFloat(txAmount.replace(/[^0-9.]/g, ''));
    if (!txAmount || isNaN(amt) || amt <= 0) {
      Alert.alert('입력 오류', '금액을 올바르게 입력해 주세요.');
      return;
    }
    const paid = parseFloat(txPaidAmount.replace(/[^0-9.]/g, '') || '0');
    const cust = customers.find((c) => c.id === txCustomerId);
    const newTx = {
      id: Date.now().toString(),
      type: txType,
      imageUri: txImage,
      amount: amt,
      paidAmount: Math.min(paid, amt),
      date: txDate,
      customerId: txCustomerId || null,
      customerName: cust?.name || '',
      note: txNote,
      createdAt: new Date().toISOString(),
    };
    console.log('[INFO] 거래 추가', { id: newTx.id, type: newTx.type, amount: newTx.amount });
    saveTransactions([newTx, ...transactions]);
    setAddTxVisible(false);
  };

  const deleteTransaction = (id) => {
    Alert.alert('삭제', '이 거래를 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: () => {
          console.log('[INFO] 거래 삭제', id);
          saveTransactions(transactions.filter((t) => t.id !== id));
          setTxDetailVisible(false);
        },
      },
    ]);
  };

  const markFullyPaid = (tx) => {
    const updated = transactions.map((t) => t.id === tx.id ? { ...t, paidAmount: t.amount } : t);
    saveTransactions(updated);
    setSelectedTx({ ...tx, paidAmount: tx.amount });
    console.log('[INFO] 전액 완납 처리', tx.id);
  };

  const addPartialPay = (tx) => {
    const pay = parseFloat(payInput.replace(/[^0-9.]/g, '') || '0');
    if (!pay || pay <= 0) { Alert.alert('입력 오류', '결제 금액을 입력해 주세요.'); return; }
    const newPaid = Math.min((tx.paidAmount || 0) + pay, tx.amount);
    const updated = transactions.map((t) => t.id === tx.id ? { ...t, paidAmount: newPaid } : t);
    saveTransactions(updated);
    setSelectedTx({ ...tx, paidAmount: newPaid });
    setPayInput('');
    console.log('[INFO] 부분 결제 처리', tx.id, pay);
  };

  // ─── 거래처 CRUD ──────────────────────────────────────────────────────────

  const submitCustomer = () => {
    if (!custName.trim()) { Alert.alert('입력 오류', '거래처명을 입력해 주세요.'); return; }
    const newCust = {
      id: Date.now().toString(),
      name: custName.trim(),
      phone: custPhone.trim(),
      note: custNote.trim(),
    };
    console.log('[INFO] 거래처 추가', newCust.name);
    saveCustomers([...customers, newCust]);
    setCustName(''); setCustPhone(''); setCustNote('');
    setAddCustomerVisible(false);
  };

  const deleteCustomer = (id) => {
    Alert.alert('삭제', '이 거래처를 삭제하시겠습니까?\n(관련 거래 내역은 유지됩니다)', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: () => { console.log('[INFO] 거래처 삭제', id); saveCustomers(customers.filter((c) => c.id !== id)); },
      },
    ]);
  };

  // ─── 재고 CRUD ────────────────────────────────────────────────────────────

  const openAddInventory = () => {
    setInvName(''); setInvUnit('개'); setInvCostPrice('');
    setInvSellingPrice(''); setInvMinQty('5'); setInvNote('');
    setAddInvVisible(true);
  };

  const submitInventory = () => {
    if (!invName.trim()) { Alert.alert('입력 오류', '상품명을 입력해주세요.'); return; }
    const newItem = {
      id: Date.now().toString(),
      name: invName.trim(),
      unit: invUnit || '개',
      quantity: 0,
      costPrice: parseFloat(invCostPrice) || 0,
      sellingPrice: parseFloat(invSellingPrice) || 0,
      minQuantity: parseFloat(invMinQty) || 0,
      note: invNote.trim(),
      createdAt: new Date().toISOString(),
    };
    console.log('[INFO] 재고 항목 추가', newItem.name);
    saveInventory([...inventory, newItem]);
    setAddInvVisible(false);
  };

  const adjustInventory = () => {
    if (!selectedInv) return;
    const qty = parseFloat(adjQty) || 0;
    if (qty <= 0) { Alert.alert('입력 오류', '수량을 올바르게 입력해주세요.'); return; }

    const delta = adjType === '출고' ? -qty : qty;
    const newQty = Math.max(0, selectedInv.quantity + delta);

    const updatedInventory = inventory.map((item) =>
      item.id === selectedInv.id ? { ...item, quantity: newQty } : item
    );
    const newMovement = {
      id: Date.now().toString(),
      inventoryId: selectedInv.id,
      type: adjType,
      quantity: delta,
      date: todayStr(),
      note: adjNote.trim(),
      createdAt: new Date().toISOString(),
    };

    console.log('[INFO] 재고 조정', selectedInv.name, adjType, qty, '→ 잔량', newQty);
    saveInventory(updatedInventory);
    saveMovements([newMovement, ...movements]);
    setSelectedInv({ ...selectedInv, quantity: newQty });
    setAdjQty('');
    setAdjNote('');
  };

  const deleteInventory = (id) => {
    Alert.alert('삭제', '이 재고 항목을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: () => {
          console.log('[INFO] 재고 삭제', id);
          saveInventory(inventory.filter((i) => i.id !== id));
          setInvDetailVisible(false);
        },
      },
    ]);
  };

  // ─── API 키 저장 ──────────────────────────────────────────────────────────

  const saveApiKey = async () => {
    try {
      await AsyncStorage.setItem(API_KEY_STORAGE, apiKeyInput.trim());
      setApiKey(apiKeyInput.trim());
      setApiKeyModalVisible(false);
      console.log('[INFO] API 키 저장 완료');
      Alert.alert('저장 완료', 'Claude API 키가 저장되었습니다.');
    } catch (e) { console.error('[ERROR] API 키 저장 실패', e); }
  };

  // ─── 집계 ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalSales = transactions.filter((t) => t.type === '매출').reduce((s, t) => s + t.amount, 0);
    const totalPurchases = transactions.filter((t) => t.type === '매입').reduce((s, t) => s + t.amount, 0);
    const totalPaid = transactions.reduce((s, t) => s + (t.paidAmount || 0), 0);
    const totalUnpaid = transactions.reduce((s, t) => s + (t.amount - (t.paidAmount || 0)), 0);
    return { totalSales, totalPurchases, totalPaid, totalUnpaid };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (txFilter === '전체') return transactions;
    if (txFilter === '미결제') return transactions.filter((t) => (t.paidAmount || 0) < t.amount);
    return transactions.filter((t) => t.type === txFilter);
  }, [transactions, txFilter]);

  const customersWithStats = useMemo(() => {
    return customers.map((c) => {
      const txs = transactions.filter((t) => t.customerId === c.id);
      const totalAmount = txs.reduce((s, t) => s + t.amount, 0);
      const totalPaid = txs.reduce((s, t) => s + (t.paidAmount || 0), 0);
      return { ...c, totalAmount, unpaid: totalAmount - totalPaid, txCount: txs.length };
    });
  }, [customers, transactions]);

  const inventoryStats = useMemo(() => ({
    totalItems: inventory.length,
    lowStockCount: inventory.filter((i) => i.minQuantity > 0 && i.quantity <= i.minQuantity).length,
    totalValue: inventory.reduce((s, i) => s + i.quantity * i.costPrice, 0),
  }), [inventory]);

  // ─── 공통 렌더 헬퍼 ───────────────────────────────────────────────────────

  const StatCard = ({ label, value, color }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{formatAmount(value)}</Text>
    </View>
  );

  const TxItem = ({ item }) => {
    const unpaid = item.amount - (item.paidAmount || 0);
    const isPaid = unpaid <= 0;
    return (
      <TouchableOpacity
        style={styles.txCard}
        onPress={() => { setSelectedTx(item); setPayInput(''); setTxDetailVisible(true); }}
      >
        <View style={styles.txCardLeft}>
          <View style={[styles.typeBadge, item.type === '매출' ? styles.badgeSale : styles.badgePurchase]}>
            <Text style={styles.typeBadgeText}>{item.type}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.txCustomer} numberOfLines={1}>{item.customerName || '거래처 없음'}</Text>
            <Text style={styles.txDate} numberOfLines={1}>
              {item.date}{item.note ? ` · ${item.note}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.txCardRight}>
          <Text style={styles.txAmount}>{formatAmount(item.amount)}</Text>
          <Text style={[styles.txStatus, isPaid ? styles.statusPaid : styles.statusUnpaid]}>
            {isPaid ? '완납' : `미결 ${formatAmount(unpaid)}`}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const DetailRow = ({ label, value, valueColor }) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );

  // ─── 홈 화면 ──────────────────────────────────────────────────────────────

  const HomeScreen = () => (
    <ScrollView style={styles.screenContent} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.sectionTitle}>장부 요약</Text>
      <StatCard label="총 매출" value={stats.totalSales} color="#4f6cff" />
      <StatCard label="총 매입" value={stats.totalPurchases} color="#6c757d" />
      <StatCard label="총 결제액" value={stats.totalPaid} color="#28a745" />
      <StatCard label="미결제액" value={stats.totalUnpaid} color="#dc3545" />

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>재고 현황</Text>
      <View style={styles.invSummaryRow}>
        <View style={[styles.invSummaryCard, { borderLeftColor: '#4f6cff' }]}>
          <Text style={styles.invSummaryLabel}>총 품목</Text>
          <Text style={styles.invSummaryValue}>{inventoryStats.totalItems}개</Text>
        </View>
        <View style={[styles.invSummaryCard, { borderLeftColor: '#dc3545', marginLeft: 8 }]}>
          <Text style={styles.invSummaryLabel}>재고 부족</Text>
          <Text style={[styles.invSummaryValue, { color: inventoryStats.lowStockCount > 0 ? '#dc3545' : '#28a745' }]}>
            {inventoryStats.lowStockCount}품목
          </Text>
        </View>
        <View style={[styles.invSummaryCard, { borderLeftColor: '#28a745', marginLeft: 8 }]}>
          <Text style={styles.invSummaryLabel}>재고 원가</Text>
          <Text style={styles.invSummaryValue}>{formatAmount(inventoryStats.totalValue)}</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>최근 거래</Text>
      {transactions.length === 0 ? (
        <Text style={styles.emptyText}>아래 + 버튼으로 첫 거래를 추가해보세요.</Text>
      ) : (
        transactions.slice(0, 5).map((item) => <TxItem key={item.id} item={item} />)
      )}
    </ScrollView>
  );

  // ─── 거래 내역 화면 ───────────────────────────────────────────────────────

  const TransactionsScreen = () => (
    <View style={styles.screenContent}>
      <View style={styles.filterRow}>
        {['전체', '매출', '매입', '미결제'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, txFilter === f && styles.filterChipActive]}
            onPress={() => setTxFilter(f)}
          >
            <Text style={[styles.filterChipText, txFilter === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TxItem item={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>해당하는 거래가 없습니다.</Text>}
      />
    </View>
  );

  // ─── 거래처 화면 ──────────────────────────────────────────────────────────

  const CustomersScreen = () => (
    <View style={styles.screenContent}>
      <FlatList
        data={customersWithStats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.custCard} onLongPress={() => deleteCustomer(item.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.custName}>{item.name}</Text>
              {item.phone ? <Text style={styles.custPhone}>{item.phone}</Text> : null}
              <Text style={styles.custStats}>거래 {item.txCount}건 · 총액 {formatAmount(item.totalAmount)}</Text>
            </View>
            {item.unpaid > 0 && (
              <View style={styles.unpaidBadge}>
                <Text style={styles.unpaidBadgeText}>미결 {formatAmount(item.unpaid)}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>아래 + 버튼으로 거래처를 추가해보세요.</Text>}
      />
    </View>
  );

  // ─── 재고 화면 ────────────────────────────────────────────────────────────

  const InventoryScreen = () => (
    <View style={styles.screenContent}>
      <FlatList
        data={inventory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isLow = item.minQuantity > 0 && item.quantity <= item.minQuantity;
          return (
            <TouchableOpacity
              style={[styles.invCard, isLow && styles.invCardLow]}
              onPress={() => { setSelectedInv(item); setAdjType('입고'); setAdjQty(''); setAdjNote(''); setInvDetailVisible(true); }}
              onLongPress={() => deleteInventory(item.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.invName}>{item.name}</Text>
                <Text style={styles.invPriceRow}>
                  원가 {formatAmount(item.costPrice)} / 판매가 {formatAmount(item.sellingPrice)}
                </Text>
                {item.note ? <Text style={styles.invNoteText}>{item.note}</Text> : null}
              </View>
              <View style={styles.invRight}>
                <Text style={[styles.invQtyText, isLow && { color: '#dc3545' }]}>
                  {item.quantity} {item.unit}
                </Text>
                {isLow && <View style={styles.lowBadge}><Text style={styles.lowBadgeText}>부족</Text></View>}
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>+ 버튼으로 재고 품목을 추가하세요.</Text>}
      />
    </View>
  );

  // ─── 거래 추가 모달 ───────────────────────────────────────────────────────

  const AddTransactionModal = () => (
    <Modal visible={addTxVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>거래 추가</Text>

            <View style={styles.typeRow}>
              {['매출', '매입'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, txType === t && styles.typeBtnActive]}
                  onPress={() => setTxType(t)}
                >
                  <Text style={[styles.typeBtnText, txType === t && styles.typeBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 이미지 선택 */}
            <View style={styles.imagePickerRow}>
              <TouchableOpacity style={styles.imgPickBtn} onPress={() => pickImage(true)}>
                <Text style={styles.imgPickBtnText}>카메라 촬영</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.imgPickBtn, { marginLeft: 8 }]} onPress={() => pickImage(false)}>
                <Text style={styles.imgPickBtnText}>갤러리 선택</Text>
              </TouchableOpacity>
            </View>

            {txImage && (
              <>
                <Image source={{ uri: txImage }} style={styles.previewImage} />
                {/* AI 분석 버튼 */}
                {isAnalyzing ? (
                  <View style={styles.analyzingBox}>
                    <ActivityIndicator color="#4f6cff" size="small" />
                    <Text style={styles.analyzingText}>AI가 이미지를 분석 중입니다...</Text>
                  </View>
                ) : ocrResult ? (
                  <View style={styles.ocrResultBox}>
                    <Text style={styles.ocrResultTitle}>🤖 AI 분석 결과</Text>
                    <DetailRow label="유형" value={ocrResult.type || '-'} />
                    <DetailRow label="금액" value={ocrResult.amount ? formatAmount(ocrResult.amount) : '-'} />
                    <DetailRow label="날짜" value={ocrResult.date || '-'} />
                    <DetailRow label="상호" value={ocrResult.merchant || '-'} />
                    <TouchableOpacity style={styles.applyBtn} onPress={applyOcrResult}>
                      <Text style={styles.applyBtnText}>✅ 이 내용으로 폼 채우기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setOcrResult(null)} style={{ alignItems: 'center', marginTop: 6 }}>
                      <Text style={{ color: '#6c757d', fontSize: 13 }}>닫기</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.aiAnalyzeBtn} onPress={analyzeImage}>
                    <Text style={styles.aiAnalyzeBtnText}>🤖 AI로 자동 인식</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="총 금액 (원) *"
              keyboardType="numeric"
              value={txAmount}
              onChangeText={setTxAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="이미 결제된 금액 (원, 미입력 시 0)"
              keyboardType="numeric"
              value={txPaidAmount}
              onChangeText={setTxPaidAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="날짜 (YYYY-MM-DD)"
              value={txDate}
              onChangeText={setTxDate}
            />

            <Text style={styles.inputLabel}>거래처</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.custChip, !txCustomerId && styles.custChipActive]}
                onPress={() => setTxCustomerId('')}
              >
                <Text style={[styles.custChipText, !txCustomerId && styles.custChipTextActive]}>없음</Text>
              </TouchableOpacity>
              {customers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.custChip, txCustomerId === c.id && styles.custChipActive]}
                  onPress={() => setTxCustomerId(c.id)}
                >
                  <Text style={[styles.custChipText, txCustomerId === c.id && styles.custChipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="메모 (선택)"
              value={txNote}
              onChangeText={setTxNote}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setAddTxVisible(false)}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={submitTransaction}>
                <Text style={styles.saveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ─── 거래 상세 모달 ───────────────────────────────────────────────────────

  const TransactionDetailModal = () => {
    if (!selectedTx) return null;
    const unpaid = selectedTx.amount - (selectedTx.paidAmount || 0);
    const isPaid = unpaid <= 0;
    return (
      <Modal visible={txDetailVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>거래 상세</Text>
              {selectedTx.imageUri && <Image source={{ uri: selectedTx.imageUri }} style={styles.previewImage} />}
              <DetailRow label="유형" value={selectedTx.type} />
              <DetailRow label="날짜" value={selectedTx.date} />
              <DetailRow label="거래처" value={selectedTx.customerName || '없음'} />
              <DetailRow label="총 금액" value={formatAmount(selectedTx.amount)} />
              <DetailRow label="결제액" value={formatAmount(selectedTx.paidAmount)} valueColor="#28a745" />
              <DetailRow label="미결제액" value={isPaid ? '완납' : formatAmount(unpaid)} valueColor={isPaid ? '#28a745' : '#dc3545'} />
              {selectedTx.note ? <DetailRow label="메모" value={selectedTx.note} /> : null}

              {!isPaid && (
                <View style={styles.paySection}>
                  <Text style={styles.inputLabel}>결제 추가</Text>
                  <View style={styles.payRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                      placeholder="결제 금액 입력"
                      keyboardType="numeric"
                      value={payInput}
                      onChangeText={setPayInput}
                    />
                    <TouchableOpacity style={styles.payAddBtn} onPress={() => addPartialPay(selectedTx)}>
                      <Text style={styles.saveBtnText}>추가</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={[styles.saveButton, styles.fullPayBtn]} onPress={() => markFullyPaid(selectedTx)}>
                    <Text style={styles.saveBtnText}>전액 완납 처리</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.modalButtons, { marginTop: 20 }]}>
                <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={() => deleteTransaction(selectedTx.id)}>
                  <Text style={styles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setTxDetailVisible(false)}>
                  <Text style={styles.cancelBtnText}>닫기</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ─── 거래처 추가 모달 ─────────────────────────────────────────────────────

  const AddCustomerModal = () => (
    <Modal visible={addCustomerVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>거래처 추가</Text>
          <TextInput style={styles.input} placeholder="거래처명 *" value={custName} onChangeText={setCustName} />
          <TextInput style={styles.input} placeholder="연락처 (선택)" keyboardType="phone-pad" value={custPhone} onChangeText={setCustPhone} />
          <TextInput style={[styles.input, styles.textArea]} placeholder="메모 (선택)" value={custNote} onChangeText={setCustNote} multiline />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setAddCustomerVisible(false)}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={submitCustomer}>
              <Text style={styles.saveBtnText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ─── 재고 추가 모달 ───────────────────────────────────────────────────────

  const AddInventoryModal = () => (
    <Modal visible={addInvVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>재고 품목 추가</Text>
            <TextInput style={styles.input} placeholder="상품명 *" value={invName} onChangeText={setInvName} />
            <View style={styles.typeRow}>
              {['개', 'kg', 'box', 'L', '봉', '장'].map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, invUnit === u && styles.unitBtnActive]}
                  onPress={() => setInvUnit(u)}
                >
                  <Text style={[styles.unitBtnText, invUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="원가 (원)" keyboardType="numeric" value={invCostPrice} onChangeText={setInvCostPrice} />
            <TextInput style={styles.input} placeholder="판매가 (원)" keyboardType="numeric" value={invSellingPrice} onChangeText={setInvSellingPrice} />
            <TextInput style={styles.input} placeholder="재고 부족 알림 수량 (기본 5)" keyboardType="numeric" value={invMinQty} onChangeText={setInvMinQty} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="메모 (선택)" value={invNote} onChangeText={setInvNote} multiline />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setAddInvVisible(false)}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={submitInventory}>
                <Text style={styles.saveBtnText}>추가</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ─── 재고 상세 / 조정 모달 ────────────────────────────────────────────────

  const InventoryDetailModal = () => {
    if (!selectedInv) return null;
    const itemMovements = movements.filter((m) => m.inventoryId === selectedInv.id).slice(0, 20);
    const isLow = selectedInv.minQuantity > 0 && selectedInv.quantity <= selectedInv.minQuantity;
    return (
      <Modal visible={invDetailVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{selectedInv.name}</Text>
              <View style={styles.invDetailHeader}>
                <View>
                  <Text style={[styles.invDetailQty, isLow && { color: '#dc3545' }]}>
                    현재 {selectedInv.quantity} {selectedInv.unit}
                  </Text>
                  {isLow && <Text style={{ color: '#dc3545', fontSize: 12 }}>⚠️ 재고 부족</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.invDetailPrice}>원가 {formatAmount(selectedInv.costPrice)}</Text>
                  <Text style={styles.invDetailPrice}>판매가 {formatAmount(selectedInv.sellingPrice)}</Text>
                </View>
              </View>

              {/* 입출고 조정 */}
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>재고 조정</Text>
              <View style={styles.adjTypeRow}>
                {['입고', '출고', '조정'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.adjTypeBtn, adjType === t && styles.adjTypeBtnActive]}
                    onPress={() => setAdjType(t)}
                  >
                    <Text style={[styles.adjTypeBtnText, adjType === t && styles.adjTypeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.payRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                  placeholder={`수량 (${selectedInv.unit})`}
                  keyboardType="numeric"
                  value={adjQty}
                  onChangeText={setAdjQty}
                />
                <TouchableOpacity style={styles.payAddBtn} onPress={adjustInventory}>
                  <Text style={styles.saveBtnText}>적용</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="메모 (선택)"
                value={adjNote}
                onChangeText={setAdjNote}
              />

              {/* 이동 내역 */}
              {itemMovements.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 16 }]}>이동 내역</Text>
                  {itemMovements.map((m) => (
                    <View key={m.id} style={styles.movementRow}>
                      <View style={[styles.movTypeBadge,
                        m.type === '입고' ? { backgroundColor: '#e8f5e9' } :
                        m.type === '출고' ? { backgroundColor: '#ffe7e7' } : { backgroundColor: '#fff3e0' }
                      ]}>
                        <Text style={[styles.movTypeText,
                          m.type === '입고' ? { color: '#28a745' } :
                          m.type === '출고' ? { color: '#dc3545' } : { color: '#f57c00' }
                        ]}>{m.type}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.movQty}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity} {selectedInv.unit}
                        </Text>
                        <Text style={styles.movDate}>{m.date}{m.note ? ` · ${m.note}` : ''}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              <View style={[styles.modalButtons, { marginTop: 20 }]}>
                <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={() => deleteInventory(selectedInv.id)}>
                  <Text style={styles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setInvDetailVisible(false)}>
                  <Text style={styles.cancelBtnText}>닫기</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ─── SMS 가져오기 모달 ────────────────────────────────────────────────────

  const SmsImportModal = () => (
    <Modal visible={smsImportVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>SMS로 거래 가져오기</Text>
            <Text style={styles.inputLabel}>카드 승인·이체 문자를 여기에 붙여넣으세요</Text>
            <TextInput
              style={[styles.input, styles.textArea, { height: 110 }]}
              placeholder={'[KB국민카드] 01/15 14:30 스타벅스 5,500원 승인\n또는\n[신한은행] 01/15 홍길동에게 50,000원 이체'}
              value={smsText}
              onChangeText={(t) => { setSmsText(t); setParsedSms(null); }}
              multiline
            />
            <TouchableOpacity
              style={[styles.saveButton, { marginBottom: 16, borderRadius: 12, paddingVertical: 13 }]}
              onPress={() => parseSmsText(smsText)}
            >
              <Text style={styles.saveBtnText}>분석하기</Text>
            </TouchableOpacity>

            {parsedSms && (
              <View style={styles.parsedBox}>
                <Text style={[styles.inputLabel, { marginBottom: 10 }]}>분석 결과</Text>
                <DetailRow label="유형" value={parsedSms.type || '-'} />
                <DetailRow label="금액" value={parsedSms.amount ? formatAmount(parsedSms.amount) : '인식 실패'} valueColor={parsedSms.amount ? '#1a1a2e' : '#dc3545'} />
                <DetailRow label="날짜" value={parsedSms.date} />
                <DetailRow label="메모" value={parsedSms.note || '-'} />
                {!parsedSms.amount && <Text style={styles.smsHint}>금액을 인식하지 못했습니다. 문자 전체를 복사해서 다시 시도하세요.</Text>}
              </View>
            )}

            <View style={[styles.modalButtons, { marginTop: 8 }]}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => { setSmsImportVisible(false); setSmsText(''); setParsedSms(null); }}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              {parsedSms && parsedSms.amount ? (
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={() => {
                    console.log('[INFO] SMS 파싱 결과로 거래 추가 폼 열기', parsedSms);
                    setTxType(parsedSms.type || '매입');
                    setTxAmount(parsedSms.amount.toString());
                    setTxPaidAmount('');
                    setTxDate(parsedSms.date);
                    setTxNote(parsedSms.note);
                    setTxImage(null);
                    setTxCustomerId('');
                    setOcrResult(null);
                    setSmsImportVisible(false);
                    setSmsText('');
                    setParsedSms(null);
                    setAddTxVisible(true);
                  }}
                >
                  <Text style={styles.saveBtnText}>거래 추가하기</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ─── API 키 설정 모달 ─────────────────────────────────────────────────────

  const ApiKeyModal = () => (
    <Modal visible={apiKeyModalVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Claude API 키 설정</Text>
          <Text style={styles.apiKeyDesc}>
            사진 AI 인식 기능을 사용하려면 Anthropic API 키가 필요합니다.{'\n'}
            anthropic.com/console 에서 발급받을 수 있습니다.{'\n'}
            키는 기기에만 저장되며 외부로 전송되지 않습니다.
          </Text>
          {apiKey ? (
            <View style={styles.apiKeyCurrentBox}>
              <Text style={styles.apiKeyCurrentLabel}>현재 저장된 키</Text>
              <Text style={styles.apiKeyCurrentValue}>{apiKey.substring(0, 20)}...</Text>
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="sk-ant-api... 형식의 API 키 입력"
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => { setApiKeyModalVisible(false); setApiKeyInput(''); }}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveApiKey}>
              <Text style={styles.saveBtnText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ─── FAB ──────────────────────────────────────────────────────────────────

  const onFab = () => {
    if (activeTab === 'customers') { setAddCustomerVisible(true); }
    else if (activeTab === 'inventory') { openAddInventory(); }
    else { openAddTx(); }
  };

  // ─── 메인 렌더 ────────────────────────────────────────────────────────────

  const tabTitles = { home: '장부 홈', transactions: '거래 내역', customers: '거래처 관리', inventory: '재고 관리' };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{tabTitles[activeTab]}</Text>
          {activeTab === 'home' && (
            <Text style={styles.subtitle}>거래 {transactions.length}건 · 미결제 {formatAmount(stats.totalUnpaid)}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity style={styles.smsBtn} onPress={() => { setSmsText(''); setParsedSms(null); setSmsImportVisible(true); }}>
            <Text style={styles.smsBtnText}>📱 SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => { setApiKeyInput(apiKey); setApiKeyModalVisible(true); }}>
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'home' && <HomeScreen />}
      {activeTab === 'transactions' && <TransactionsScreen />}
      {activeTab === 'customers' && <CustomersScreen />}
      {activeTab === 'inventory' && <InventoryScreen />}

      <TouchableOpacity style={styles.fab} onPress={onFab}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <View style={styles.tabBar}>
        {[
          { key: 'home', label: '홈' },
          { key: 'transactions', label: '거래' },
          { key: 'customers', label: '거래처' },
          { key: 'inventory', label: '재고' },
        ].map((tab) => (
          <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            {activeTab === tab.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <AddTransactionModal />
      <TransactionDetailModal />
      <AddCustomerModal />
      <AddInventoryModal />
      <InventoryDetailModal />
      <SmsImportModal />
      <ApiKeyModal />
    </SafeAreaView>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  header: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#6c757d' },
  smsBtn: { backgroundColor: '#e8ecff', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  smsBtnText: { color: '#4f6cff', fontWeight: '700', fontSize: 12 },
  settingsBtn: { backgroundColor: '#f3f4f8', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  settingsBtnText: { fontSize: 16 },

  screenContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginBottom: 10 },

  // 통계 카드
  statCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16, marginBottom: 10,
    borderLeftWidth: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  statLabel: { fontSize: 14, color: '#6c757d' },
  statValue: { fontSize: 18, fontWeight: '700' },

  // 재고 요약 (홈)
  invSummaryRow: { flexDirection: 'row', marginBottom: 4 },
  invSummaryCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 12, borderLeftWidth: 3,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  invSummaryLabel: { fontSize: 11, color: '#6c757d', marginBottom: 4 },
  invSummaryValue: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },

  // 거래 카드
  txCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  txCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  txCardRight: { alignItems: 'flex-end', marginLeft: 8 },
  typeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeSale: { backgroundColor: '#e8ecff' },
  badgePurchase: { backgroundColor: '#f0f0f0' },
  typeBadgeText: { fontSize: 12, fontWeight: '700', color: '#4f6cff' },
  txCustomer: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  txDate: { fontSize: 12, color: '#6c757d', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  txStatus: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  statusPaid: { color: '#28a745' },
  statusUnpaid: { color: '#dc3545' },

  // 필터
  filterRow: { flexDirection: 'row', marginBottom: 14, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#e9ecef' },
  filterChipActive: { backgroundColor: '#4f6cff' },
  filterChipText: { fontSize: 13, color: '#6c757d', fontWeight: '600' },
  filterChipTextActive: { color: '#ffffff' },

  // 거래처 카드
  custCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  custName: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  custPhone: { fontSize: 13, color: '#6c757d', marginTop: 2 },
  custStats: { fontSize: 12, color: '#adb5bd', marginTop: 4 },
  unpaidBadge: { backgroundColor: '#ffe7e7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  unpaidBadgeText: { color: '#dc3545', fontSize: 12, fontWeight: '700' },

  // 재고 카드
  invCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  invCardLow: { borderWidth: 1, borderColor: '#ffc0c0' },
  invName: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 2 },
  invPriceRow: { fontSize: 12, color: '#6c757d' },
  invNoteText: { fontSize: 12, color: '#adb5bd', marginTop: 2 },
  invRight: { alignItems: 'flex-end', marginLeft: 12 },
  invQtyText: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  lowBadge: { backgroundColor: '#ffe7e7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  lowBadgeText: { color: '#dc3545', fontSize: 11, fontWeight: '700' },

  // 재고 상세
  invDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  invDetailQty: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },
  invDetailPrice: { fontSize: 13, color: '#6c757d' },

  // 재고 조정
  adjTypeRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  adjTypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  adjTypeBtnActive: { backgroundColor: '#4f6cff' },
  adjTypeBtnText: { fontSize: 14, fontWeight: '700', color: '#6c757d' },
  adjTypeBtnTextActive: { color: '#ffffff' },

  // 이동 내역
  movementRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  movTypeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  movTypeText: { fontSize: 12, fontWeight: '700' },
  movQty: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  movDate: { fontSize: 12, color: '#6c757d', marginTop: 2 },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 76, width: 56, height: 56,
    borderRadius: 28, backgroundColor: '#4f6cff', justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#4f6cff', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: '#ffffff', fontSize: 30, lineHeight: 32, fontWeight: '400' },

  // 탭바
  tabBar: {
    flexDirection: 'row', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e9ecef',
    paddingBottom: Platform.OS === 'ios' ? 16 : 8, paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  tabLabel: { fontSize: 11, color: '#adb5bd', fontWeight: '600' },
  tabLabelActive: { color: '#4f6cff' },
  tabIndicator: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4f6cff', marginTop: 4 },

  // 공통
  emptyText: { textAlign: 'center', color: '#adb5bd', fontSize: 14, marginTop: 40, lineHeight: 22 },
  list: { paddingBottom: 100 },

  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%', padding: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 20 },

  // 거래 유형
  typeRow: { flexDirection: 'row', marginBottom: 16, gap: 10, flexWrap: 'wrap' },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center', minWidth: 60 },
  typeBtnActive: { backgroundColor: '#4f6cff' },
  typeBtnText: { fontSize: 15, fontWeight: '700', color: '#6c757d' },
  typeBtnTextActive: { color: '#ffffff' },

  // 재고 단위 버튼
  unitBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  unitBtnActive: { backgroundColor: '#4f6cff' },
  unitBtnText: { fontSize: 13, fontWeight: '600', color: '#6c757d' },
  unitBtnTextActive: { color: '#ffffff' },

  // 이미지 선택
  imagePickerRow: { flexDirection: 'row', marginBottom: 12 },
  imgPickBtn: { flex: 1, backgroundColor: '#e8ecff', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  imgPickBtnText: { color: '#4f6cff', fontWeight: '700', fontSize: 14 },
  previewImage: { width: '100%', height: 200, borderRadius: 14, marginBottom: 10 },

  // AI 분석
  aiAnalyzeBtn: { backgroundColor: '#f0f4ff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#c5d0ff' },
  aiAnalyzeBtnText: { color: '#4f6cff', fontWeight: '700', fontSize: 14 },
  analyzingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4ff', borderRadius: 12, padding: 14, marginBottom: 14, gap: 10 },
  analyzingText: { color: '#4f6cff', fontSize: 13, fontWeight: '600' },
  ocrResultBox: { backgroundColor: '#f8f9ff', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#c5d0ff' },
  ocrResultTitle: { fontSize: 14, fontWeight: '700', color: '#4f6cff', marginBottom: 10 },
  applyBtn: { backgroundColor: '#4f6cff', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  applyBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

  // 입력
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#6c757d', marginBottom: 8 },
  input: {
    backgroundColor: '#f3f4f8', borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11, fontSize: 15, marginBottom: 12, color: '#1a1a2e',
  },
  textArea: { height: 90, textAlignVertical: 'top' },

  // 거래처 칩
  custChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 8 },
  custChipActive: { backgroundColor: '#4f6cff' },
  custChipText: { fontSize: 13, color: '#6c757d', fontWeight: '600' },
  custChipTextActive: { color: '#ffffff' },

  // 모달 버튼
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  saveButton: { backgroundColor: '#4f6cff' },
  deleteButton: { backgroundColor: '#ffe7e7' },
  cancelBtnText: { color: '#6c757d', fontWeight: '700', fontSize: 15 },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  deleteBtnText: { color: '#dc3545', fontWeight: '700', fontSize: 15 },

  // 거래 상세
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  detailLabel: { fontSize: 14, color: '#6c757d' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#1a1a2e', flexShrink: 1, textAlign: 'right', marginLeft: 16 },

  // 결제
  paySection: { marginTop: 16, padding: 14, backgroundColor: '#f8f9ff', borderRadius: 14 },
  payRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  payAddBtn: { backgroundColor: '#4f6cff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  fullPayBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center' },

  // SMS
  parsedBox: { backgroundColor: '#f8f9ff', borderRadius: 14, padding: 14, marginBottom: 16 },
  smsHint: { marginTop: 10, fontSize: 12, color: '#dc3545', lineHeight: 18 },

  // API 키
  apiKeyDesc: { fontSize: 13, color: '#6c757d', lineHeight: 20, marginBottom: 16 },
  apiKeyCurrentBox: { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 12, marginBottom: 12 },
  apiKeyCurrentLabel: { fontSize: 11, color: '#4f6cff', fontWeight: '600', marginBottom: 4 },
  apiKeyCurrentValue: { fontSize: 13, color: '#1a1a2e', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});
