import React, { useEffect, useState, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
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
  const [activeTab, setActiveTab] = useState('home');

  // 모달 가시성
  const [addTxVisible, setAddTxVisible] = useState(false);
  const [txDetailVisible, setTxDetailVisible] = useState(false);
  const [addCustomerVisible, setAddCustomerVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  // 거래 입력 폼
  const [txType, setTxType] = useState('매출');
  const [txImage, setTxImage] = useState(null);
  const [txAmount, setTxAmount] = useState('');
  const [txPaidAmount, setTxPaidAmount] = useState('');
  const [txDate, setTxDate] = useState(todayStr());
  const [txCustomerId, setTxCustomerId] = useState('');
  const [txNote, setTxNote] = useState('');

  // 거래처 입력 폼
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custNote, setCustNote] = useState('');

  // 거래 목록 필터
  const [txFilter, setTxFilter] = useState('전체');

  // 부분결제 입력
  const [payInput, setPayInput] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // ─── 데이터 로드/저장 ─────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      console.log('[INFO] 데이터 불러오기 시작');
      const [txRaw, custRaw] = await Promise.all([
        AsyncStorage.getItem(TRANSACTIONS_KEY),
        AsyncStorage.getItem(CUSTOMERS_KEY),
      ]);
      if (txRaw) setTransactions(JSON.parse(txRaw));
      if (custRaw) setCustomers(JSON.parse(custRaw));
      console.log('[INFO] 데이터 불러오기 완료');
    } catch (e) {
      console.error('[ERROR] 데이터 불러오기 실패', e);
    }
  };

  const saveTransactions = async (list) => {
    try {
      await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(list));
      setTransactions(list);
    } catch (e) {
      console.error('[ERROR] 거래 저장 실패', e);
    }
  };

  const saveCustomers = async (list) => {
    try {
      await AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list));
      setCustomers(list);
    } catch (e) {
      console.error('[ERROR] 거래처 저장 실패', e);
    }
  };

  // ─── 이미지 선택 ──────────────────────────────────────────────────────────

  const pickImage = async (useCamera) => {
    try {
      let result;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('권한 필요', '카메라 권한을 허용해 주세요.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('권한 필요', '갤러리 권한을 허용해 주세요.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      }
      if (!result.canceled) {
        setTxImage(result.assets[0].uri);
        console.log('[INFO] 이미지 선택 완료', result.assets[0].uri);
      }
    } catch (e) {
      console.error('[ERROR] 이미지 선택 실패', e);
    }
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
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          console.log('[INFO] 거래 삭제', id);
          saveTransactions(transactions.filter((t) => t.id !== id));
          setTxDetailVisible(false);
        },
      },
    ]);
  };

  const markFullyPaid = (tx) => {
    const updated = transactions.map((t) =>
      t.id === tx.id ? { ...t, paidAmount: t.amount } : t
    );
    saveTransactions(updated);
    setSelectedTx({ ...tx, paidAmount: tx.amount });
    console.log('[INFO] 전액 완납 처리', tx.id);
  };

  const addPartialPay = (tx) => {
    const pay = parseFloat(payInput.replace(/[^0-9.]/g, '') || '0');
    if (!pay || pay <= 0) {
      Alert.alert('입력 오류', '결제 금액을 입력해 주세요.');
      return;
    }
    const newPaid = Math.min((tx.paidAmount || 0) + pay, tx.amount);
    const updated = transactions.map((t) =>
      t.id === tx.id ? { ...t, paidAmount: newPaid } : t
    );
    saveTransactions(updated);
    const updatedTx = { ...tx, paidAmount: newPaid };
    setSelectedTx(updatedTx);
    setPayInput('');
    console.log('[INFO] 부분 결제 처리', tx.id, pay, '→ 총', newPaid);
  };

  // ─── 거래처 CRUD ──────────────────────────────────────────────────────────

  const submitCustomer = () => {
    if (!custName.trim()) {
      Alert.alert('입력 오류', '거래처명을 입력해 주세요.');
      return;
    }
    const newCust = {
      id: Date.now().toString(),
      name: custName.trim(),
      phone: custPhone.trim(),
      note: custNote.trim(),
    };
    console.log('[INFO] 거래처 추가', newCust.name);
    saveCustomers([...customers, newCust]);
    setCustName('');
    setCustPhone('');
    setCustNote('');
    setAddCustomerVisible(false);
  };

  const deleteCustomer = (id) => {
    Alert.alert('삭제', '이 거래처를 삭제하시겠습니까?\n(관련 거래 내역은 유지됩니다)', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          console.log('[INFO] 거래처 삭제', id);
          saveCustomers(customers.filter((c) => c.id !== id));
        },
      },
    ]);
  };

  // ─── 집계 ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalSales = transactions
      .filter((t) => t.type === '매출')
      .reduce((s, t) => s + t.amount, 0);
    const totalPurchases = transactions
      .filter((t) => t.type === '매입')
      .reduce((s, t) => s + t.amount, 0);
    const totalPaid = transactions.reduce((s, t) => s + (t.paidAmount || 0), 0);
    const totalUnpaid = transactions.reduce(
      (s, t) => s + (t.amount - (t.paidAmount || 0)),
      0
    );
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
        onPress={() => {
          setSelectedTx(item);
          setPayInput('');
          setTxDetailVisible(true);
        }}
      >
        <View style={styles.txCardLeft}>
          <View style={[styles.typeBadge, item.type === '매출' ? styles.badgeSale : styles.badgePurchase]}>
            <Text style={styles.typeBadgeText}>{item.type}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.txCustomer} numberOfLines={1}>
              {item.customerName || '거래처 없음'}
            </Text>
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

  // ─── 홈 화면 ──────────────────────────────────────────────────────────────

  const HomeScreen = () => (
    <ScrollView style={styles.screenContent} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.sectionTitle}>장부 요약</Text>
      <StatCard label="총 매출" value={stats.totalSales} color="#4f6cff" />
      <StatCard label="총 매입" value={stats.totalPurchases} color="#6c757d" />
      <StatCard label="총 결제액" value={stats.totalPaid} color="#28a745" />
      <StatCard label="미결제액" value={stats.totalUnpaid} color="#dc3545" />

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
            <Text style={[styles.filterChipText, txFilter === f && styles.filterChipTextActive]}>
              {f}
            </Text>
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
              <Text style={styles.custStats}>
                거래 {item.txCount}건 · 총액 {formatAmount(item.totalAmount)}
              </Text>
            </View>
            {item.unpaid > 0 && (
              <View style={styles.unpaidBadge}>
                <Text style={styles.unpaidBadgeText}>미결 {formatAmount(item.unpaid)}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>아래 + 버튼으로 거래처를 추가해보세요.</Text>
        }
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
                  <Text style={[styles.typeBtnText, txType === t && styles.typeBtnTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.imagePickerRow}>
              <TouchableOpacity style={styles.imgPickBtn} onPress={() => pickImage(true)}>
                <Text style={styles.imgPickBtnText}>카메라 촬영</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imgPickBtn, { marginLeft: 8 }]}
                onPress={() => pickImage(false)}
              >
                <Text style={styles.imgPickBtnText}>갤러리 선택</Text>
              </TouchableOpacity>
            </View>
            {txImage && <Image source={{ uri: txImage }} style={styles.previewImage} />}

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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              <TouchableOpacity
                style={[styles.custChip, !txCustomerId && styles.custChipActive]}
                onPress={() => setTxCustomerId('')}
              >
                <Text style={[styles.custChipText, !txCustomerId && styles.custChipTextActive]}>
                  없음
                </Text>
              </TouchableOpacity>
              {customers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.custChip, txCustomerId === c.id && styles.custChipActive]}
                  onPress={() => setTxCustomerId(c.id)}
                >
                  <Text
                    style={[styles.custChipText, txCustomerId === c.id && styles.custChipTextActive]}
                  >
                    {c.name}
                  </Text>
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
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAddTxVisible(false)}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={submitTransaction}
              >
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

              {selectedTx.imageUri && (
                <Image source={{ uri: selectedTx.imageUri }} style={styles.previewImage} />
              )}

              <DetailRow label="유형" value={selectedTx.type} />
              <DetailRow label="날짜" value={selectedTx.date} />
              <DetailRow label="거래처" value={selectedTx.customerName || '없음'} />
              <DetailRow label="총 금액" value={formatAmount(selectedTx.amount)} />
              <DetailRow
                label="결제액"
                value={formatAmount(selectedTx.paidAmount)}
                valueColor="#28a745"
              />
              <DetailRow
                label="미결제액"
                value={isPaid ? '완납' : formatAmount(unpaid)}
                valueColor={isPaid ? '#28a745' : '#dc3545'}
              />
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
                    <TouchableOpacity
                      style={styles.payAddBtn}
                      onPress={() => addPartialPay(selectedTx)}
                    >
                      <Text style={styles.saveBtnText}>추가</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.saveButton, styles.fullPayBtn]}
                    onPress={() => markFullyPaid(selectedTx)}
                  >
                    <Text style={styles.saveBtnText}>전액 완납 처리</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.modalButtons, { marginTop: 20 }]}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.deleteButton]}
                  onPress={() => deleteTransaction(selectedTx.id)}
                >
                  <Text style={styles.deleteBtnText}>삭제</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setTxDetailVisible(false)}
                >
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
          <TextInput
            style={styles.input}
            placeholder="거래처명 *"
            value={custName}
            onChangeText={setCustName}
          />
          <TextInput
            style={styles.input}
            placeholder="연락처 (선택)"
            keyboardType="phone-pad"
            value={custPhone}
            onChangeText={setCustPhone}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="메모 (선택)"
            value={custNote}
            onChangeText={setCustNote}
            multiline
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setAddCustomerVisible(false)}
            >
              <Text style={styles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={submitCustomer}
            >
              <Text style={styles.saveBtnText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ─── 상세 행 컴포넌트 ─────────────────────────────────────────────────────

  const DetailRow = ({ label, value, valueColor }) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );

  // ─── FAB ──────────────────────────────────────────────────────────────────

  const onFab = () => {
    if (activeTab === 'customers') {
      setAddCustomerVisible(true);
    } else {
      openAddTx();
    }
  };

  // ─── 메인 렌더 ────────────────────────────────────────────────────────────

  const tabTitles = { home: '장부 홈', transactions: '거래 내역', customers: '거래처 관리' };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>{tabTitles[activeTab]}</Text>
        {activeTab === 'home' && (
          <Text style={styles.subtitle}>
            거래 {transactions.length}건 · 미결제 {formatAmount(stats.totalUnpaid)}
          </Text>
        )}
      </View>

      {activeTab === 'home' && <HomeScreen />}
      {activeTab === 'transactions' && <TransactionsScreen />}
      {activeTab === 'customers' && <CustomersScreen />}

      <TouchableOpacity style={styles.fab} onPress={onFab}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <View style={styles.tabBar}>
        {[
          { key: 'home', label: '홈' },
          { key: 'transactions', label: '거래내역' },
          { key: 'customers', label: '거래처' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <AddTransactionModal />
      <TransactionDetailModal />
      <AddCustomerModal />
    </SafeAreaView>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6c757d',
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 12,
  },

  // 통계 카드
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  // 거래 카드
  txCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  txCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  txCardRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  typeBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeSale: {
    backgroundColor: '#e8ecff',
  },
  badgePurchase: {
    backgroundColor: '#f0f0f0',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f6cff',
  },
  txCustomer: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  txDate: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  txStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  statusPaid: {
    color: '#28a745',
  },
  statusUnpaid: {
    color: '#dc3545',
  },

  // 필터
  filterRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
  },
  filterChipActive: {
    backgroundColor: '#4f6cff',
  },
  filterChipText: {
    fontSize: 13,
    color: '#6c757d',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },

  // 거래처 카드
  custCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  custName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  custPhone: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },
  custStats: {
    fontSize: 12,
    color: '#adb5bd',
    marginTop: 4,
  },
  unpaidBadge: {
    backgroundColor: '#ffe7e7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unpaidBadgeText: {
    color: '#dc3545',
    fontSize: 12,
    fontWeight: '700',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 76,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4f6cff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#4f6cff',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '400',
  },

  // 하단 탭
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 12,
    color: '#adb5bd',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#4f6cff',
  },
  tabIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4f6cff',
    marginTop: 4,
  },

  // 빈 상태
  emptyText: {
    textAlign: 'center',
    color: '#adb5bd',
    fontSize: 14,
    marginTop: 40,
    lineHeight: 22,
  },
  list: {
    paddingBottom: 100,
  },

  // 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 20,
  },

  // 거래 유형 선택
  typeRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: '#4f6cff',
  },
  typeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6c757d',
  },
  typeBtnTextActive: {
    color: '#ffffff',
  },

  // 이미지 선택
  imagePickerRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  imgPickBtn: {
    flex: 1,
    backgroundColor: '#e8ecff',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  imgPickBtnText: {
    color: '#4f6cff',
    fontWeight: '700',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    marginBottom: 14,
  },

  // 입력
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f3f4f8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    fontSize: 15,
    marginBottom: 12,
    color: '#1a1a2e',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },

  // 거래처 칩
  custChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  custChipActive: {
    backgroundColor: '#4f6cff',
  },
  custChipText: {
    fontSize: 13,
    color: '#6c757d',
    fontWeight: '600',
  },
  custChipTextActive: {
    color: '#ffffff',
  },

  // 모달 버튼
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#4f6cff',
  },
  deleteButton: {
    backgroundColor: '#ffe7e7',
  },
  cancelBtnText: {
    color: '#6c757d',
    fontWeight: '700',
    fontSize: 15,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  deleteBtnText: {
    color: '#dc3545',
    fontWeight: '700',
    fontSize: 15,
  },

  // 거래 상세
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 16,
  },

  // 결제 처리 영역
  paySection: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#f8f9ff',
    borderRadius: 14,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  payAddBtn: {
    backgroundColor: '#4f6cff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  fullPayBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
});
