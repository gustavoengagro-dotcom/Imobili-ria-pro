import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Contract, Property, Client, ContractStatus } from '../types';
import { 
  Plus, 
  Search, 
  FileText, 
  Calendar, 
  DollarSign, 
  Trash2, 
  Edit2, 
  X, 
  Save,
  Download,
  AlertCircle,
  ClipboardCheck,
  Camera,
  Trash
} from 'lucide-react';
import { formatCurrency, formatDate, cn, isValidCpfCnpj, toBase64 } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthGuard';
import { ConfirmModal } from '../components/ConfirmModal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const DEFAULT_CLAUSES = [
  'CLÁUSULA PRIMEIRA - OBJETO DO CONTRATO\nO LOCADOR aluga ao LOCATÁRIO o imóvel residencial situado à {ADDRESS}, composto por {DESCRIPTION}.',
  'CLÁUSULA SEGUNDA - DA DESTINAÇÃO DO IMÓVEL\n2.1 O LOCATÁRIO declara que o imóvel, ora locado, destina-se única e exclusivamente para o seu uso RESIDENCIAL.\n2.2 O LOCATÁRIO obriga por si e demais dependentes a cumprir e a fazer cumprir integralmente as disposições legais sobre o Condomínio, a sua Convenção e o seu Regulamento Interno.',
  'CLÁUSULA TERCEIRA - DO PRAZO DE VIGÊNCIA\n3.1 O prazo da locação é de seis meses, iniciando-se em {START_DATE} com término em {END_DATE}, com prorrogação automática após o término das especificações citadas acima.\n3.2 Findo o prazo ajustado, se o locatário continuar na posse do imóvel alugado por mais de trinta dias sem oposição do locador, presume - se - á prorrogada a locação por prazo indeterminado, mantidas as demais cláusulas e condições do contrato.',
  'CLÁUSULA QUARTA - DA FORMA DE PAGAMENTO\n4.1 O aluguel mensal deverá ser pago até o dia 5 (cinco) do mês subsequente ao vencido, por meio de PIX informado no campo abaixo , no valor de {MONTHLY_VALUE} , reajustados anualmente, pelo {ADJUSTMENT_INDEX} , reajustamento este sempre incidente e calculado sobre o último aluguel pago no último mês do ano anterior.\n4.2 O aluguel mensal será de {MONTHLY_VALUE}, pagável até o dia 5 de cada mês, mediante transferência via PIX para o LOCADOR, utilizando a seguinte chave PIX.\n* Chave PIX CPF nº {OWNER_CPF}, pertencente a {OWNER_NAME}.\n4.3 O comprovante de pagamento deverá ser enviado ao LOCADOR imediatamente após a realização da transferência, através de whatsapp (64) 999696680 ou outro meio acordado entre as partes.',
  'CLÁUSULA QUINTA - DA MULTA E JUROS DE MORA\n5.1 Em caso de mora no pagamento do aluguel, o valor será corrigido pelo {ADJUSTMENT_INDEX} até o dia do efetivo pagamento e acrescido da multa moratória de {LATE_FEE}% e dos juros de 1% (um por cento) ao dia de atraso.',
  'CLÁUSULA SEXTA – GARANTIA LOCATÍCIA (CAUÇÃO OU SEGURO FIANÇA)\n6.1 Para garantia do fiel cumprimento das obrigações assumidas neste contrato, o LOCATÁRIO optará por uma das seguintes modalidades de garantia locatícia:\nI – DEPÓSITO CAUÇÃO:\nO LOCATÁRIO entregará ao LOCADOR, neste ato, a quantia equivalente a um meses de aluguel vigente, a título de caução, totalizando o valor de {MONTHLY_VALUE}, a ser depositado em conta vinculada conforme previsto na Lei nº 8.245/91.\nParágrafo Primeiro: O valor da caução será devolvido ao LOCATÁRIO ao final da locação, desde que não haja débitos pendentes relativos a aluguéis, encargos, danos ao imóvel ou quaisquer outras obrigações contratuais.\nParágrafo Segundo: Caso existam débitos ou danos, o LOCADOR poderá utilizar total ou parcialmente o valor da caução para sua quitação, devendo eventual saldo remanescente ser devolvido ao LOCATÁRIO.\nII – SEGURO FIANÇA LOCATÍCIA:\nAlternativamente, o LOCATÁRIO poderá optar pela contratação de seguro fiança locatícia junto à seguradora Porto Seguro, comprometendo-se a apresentar a apólice vigente no ato da assinatura deste contrato.\nParágrafo Primeiro: O seguro deverá permanecer válido durante todo o período da locação, sendo de inteira responsabilidade do LOCATÁRIO sua renovação anual ou conforme exigido pela seguradora.\nParágrafo Segundo: A apólice deverá cobrir, no mínimo, os valores referentes a aluguéis, encargos locatícios, multas contratuais e eventuais danos ao imóvel.\nParágrafo Terceiro: A não renovação ou cancelamento do seguro implicará em infração contratual, podendo o LOCADOR exigir a substituição imediata da garantia ou considerar rescindido o contrato, conforme legislação vigente.',
  'CLÁUSULA SÉTIMA - DA CONSERVAÇÃO, REFORMAS E BENFEITORIAS NECESSÁRIAS\n7.1. Ao LOCATÁRIO recai a responsabilidade por zelar pela conservação, limpeza e segurança do imóvel.\n7.2 As benfeitorias necessárias introduzidas pelo LOCATÁRIO, ainda que não autorizadas pelo LOCADOR, bem como as úteis, desde que autorizadas, serão indenizáveis e permitem o exercício do direito de retenção. As benfeitorias voluptuárias não serão indenizáveis, podendo ser levantadas pelo LOCATÁRIO, finda a locação, desde que sua retirada não afete a estrutura e a substância do imóvel.\n7.3 O LOCATÁRIO está obrigado a devolver o imóvel em perfeitas condições de limpeza, conservação e pintura, quando finda ou rescindida esta avença, conforme constante no termo de vistoria em anexo.\n7.4 O LOCATÁRIO não poderá realizar obras que alterem ou modifiquem a estrutura do imóvel locado, sem prévia autorização por escrito. No caso de prévia autorização, as obras serão incorporadas ao imóvel, sem que caiba ao LOCATÁRIO qualquer indenização pelas obras ou retenção por benfeitorias.\n7.5 Cabe ao LOCATÁRIO verificar a voltagem e a capacidade de instalação elétrica existente no imóvel, sendo de sua exclusiva responsabilidade pelos danos e prejuízos que venham a ser causados em seus equipamentos elétrico-eletrônico por inadequação à voltagem e/ou capacidade instalada. Qualquer alteração da voltagem deverá de imediato ser comunicada ao LOCADOR, por escrito. Ao final da locação, antes de fazer a entrega das chaves, o LOCATÁRIO deverá proceder a mudança para a voltagem original.\n7.6 O LOCADOR deve responder pelos vícios ou defeitos anteriores à locação.\n7.7 O LOCATÁRIO(a) se compromete a manter o imóvel em boas condições de conservação e limpeza durante todo o período de locação.\n7.8 O LOCATÁRIO será cobrado um valor fixo de {MONTHLY_VALUE} para cobrir os custos de pintura, valor este que será pago ao LOCADOR no momento da entrega das chaves.\n7.9 O LOCATÁRIO(a) também é responsável por realizar todos os reparos necessários para devolver o imóvel nas mesmas condições in que o recebeu, salvo deteriorações decorrentes do uso normal.\n7.10 Em caso de não cumprimento das obrigações de reparo, o LOCADOR(a) poderá executar os serviços necessários e cobrar do LOCATÁRIO(a) os custos correspondentes, os quais deverão ser quitados em até 10 (dez) dias após a notificação.\nPARÁGRAFO ÚNICO: O LOCATÁRIO declara receber o imóvel em perfeito estado de conservação e perfeito funcionamento devendo observar o que consta no termo de vistoria, não respondendo por vícios ocultos ou anteriores à locação.',
  'CLÁUSULA OITAVA - DAS TAXAS E TRIBUTOS\n8.1 A partir da data da entrega das chaves, o LOCATÁRIO(a) se responsabiliza pela transferência e pagamento das contas de água e luz, assim como de quaisquer outros tributos e taxas incidentes sobre o imóvel.\n8.2 No ato da devolução do imóvel, o LOCATÁRIO(a) se compromete a apresentar os comprovantes de pagamento de todas as taxas e tributos durante o período de locação, garantindo que não há débitos pendentes relacionados ao imóvel.',
  'CLÁUSULA NONA - DOS SINISTROS\n9.1 No caso de sinistro do prédio, parcial ou total, que impossibilite a habitação do imóvel locado, o presente contrato estará rescindido, independentemente de aviso ou interpelação judicial ou extrajudicial.\n9.2 No caso de incêndio parcial, obrigando obras de reconstrução, o presente contrato terá suspensa a sua vigência, sendo devolvido ao LOCATÁRIO após a reconstrução, que ficará prorrogado pelo mesmo tempo de duração das obras de reconstrução.',
  'CLÁUSULA DÉCIMA - DA SUBLOCAÇÃO\n10.1 É VEDADO ao LOCATÁRIO sublocar, transferir ou ceder o imóvel, sendo nulo de pleno direito qualquer ato praticado com este fim sem o consentimento prévio e por escrito do LOCADOR.',
  'CLÁUSULA DÉCIMA PRIMEIRA - DA DESAPROPRIAÇÃO\n11.1 Em caso de desapropriação total ou parcial do imóvel locado, ficará rescindido de pleno direito o presente contrato de locação, sendo passível de indenização as perdas e danos efetivamente demonstradas.',
  'CLÁUSULA DÉCIMA SEGUNDA - DOS CASOS DE FALECIMENTO\n12.1 Falecendo o LOCADOR, ficam os seus sucessores sub-rogados dos direitos do presente contrato, devendo o LOCATÁRIO seguir depositando o valor do aluguel em conta indicada pelo inventariante, após devidamente notificado.\n12.2 Falecendo o LOCATÁRIO, ficam os seus sucessores sub-rogados dos direitos do presente contrato, devendo decidir dentro de 30 dias da continuidade ou não da LOCAÇÃO. O locador deve ser notificado da morte do LOCATÁRIO e informado de quem será o novo sucessor.',
  'CLÁUSULA DÉCIMA TERCEIRA - DA ALIENAÇÃO DO IMÓVEL\n13.1 No caso de alienação do imóvel, o LOCATÁRIO terá direito de preferência, e se não utilizar-se dessa prerrogativa formalmente, o LOCADOR poderá dispor livremente do imóvel.',
  'CLÁUSULA DÉCIMA QUARTA - DAS VISTORIAS\n14.1 É facultado ao LOCADOR, mediante aviso prévio, vistoriar o imóvel, por si ou seus procuradores, sempre que achar conveniente, para a certeza do cumprimento das obrigações assumidas neste contrato.',
  'CLÁUSULA DÉCIMA QUINTA - DOS ANIMAIS DOMÉSTICOS\n15.1 É permitida a presença de animais domésticos no interior do imóvel, desde que o LOCATÁRIO(a) se responsabilize integralmente por qualquer dano ou prejuízo que os animais possam causar às dependências do imóvel, a terceiros ou a áreas comuns, caso aplicável.\n15.2 O LOCATÁRIO(a) deverá garantir que os animais domésticos não perturbem a paz e a tranquilidade dos vizinhos, observando sempre as regras de convivência do condomínio (se houver) e da vizinhança.\n15.3 No término do contrato ou na devolução do imóvel, o LOCATÁRIO(a) deverá entregar o imóvel em condições de limpeza e conservação adequadas, livres de quaisquer vestígios que possam comprometer a integridade ou a higiene do imóvel devido à presença dos animais domésticos.\n15.4 Fica a cargo do LOCATÁRIO(a) o cumprimento das normas de saúde e segurança aplicáveis à criação e manutenção de animais domésticos, incluindo a responsabilidade por vacinação, higiene e controle de zoonoses.',
  'CLÁUSULA DÉCIMA SEXTA - DA RESCISÃO DO CONTRATO\n16.1 Em caso de rescisão antecipada do contrato pelo LOCATÁRIO(a), será devida uma multa proporcional ao tempo restante do contrato, correspondente a 3 (três) meses de aluguel.\n16.2 O cálculo da multa será feito da seguinte forma:\n* Multa total estipulada: 3 x {MONTHLY_VALUE}\n* Tempo total do contrato: 6 meses\n* Tempo restante até o término do contrato: (quantidade de meses restantes)\nMulta proporcional = (Tempo restante / Tempo total do contrato) x Multa total\n16.3 O LOCADOR(a) poderá rescindir o contrato antecipadamente em caso de inadimplemento de quaisquer das cláusulas ora estabelecidas, mediante notificação por escrito ao LOCATÁRIO(a) com antecedência mínima de 30 (trinta) dias.\n16.4 O LOCATÁRIO(a) se compromete a pagar a multa de rescisão proporcional no prazo de 10 (dez) dias após a formalização da rescisão contratual, juntamente com a entrega das chaves e dos comprovantes de pagamento de todas as taxas e tributos durante o período de locação.',
  'CLÁUSULA DÉCIMA SÉTIMA - DA OBSERVÂNCIA À LGPD\n17.1 O LOCATÁRIO declara expresso CONSENTIMENTO que o LOCADOR irá coletar, tratar e compartilhar os dados necessários ao cumprimento do contrato, nos termos do Art. 7º, inc. V da LGPD, os dados necessários para cumprimento de obrigações legais, nos termos do Art. 7º, inc. II da LGPD, bem como os dados, se necessários, para proteção ao crédito, conforme autorizado pelo Art. 7º, inc. X da LGPD.',
  'CLÁUSULA DÉCIMA OITAVA - FORO\n18.1 Fica eleito o foro da Comarca de Alto Araguaia , Estado de Mato Grosso , para dirimir quaisquer questões oriundas deste contrato, com exclusão de qualquer outro, por mais privilegiado que seja.\n18.2 E por estarem assim justos e contratados, assinam o presente contrato em 2 (duas) vias de igual teor.'
];

export const Contracts: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [tenantValidationError, setTenantValidationError] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  const [newTenantData, setNewTenantData] = useState<Partial<Client>>({
    name: '',
    cpfCnpj: '',
    rg: '',
    phone: '',
    email: '',
    type: 'inquilino'
  });

  const [formData, setFormData] = useState<Partial<Contract>>({
    propertyId: '',
    tenantId: '',
    ownerId: '',
    startDate: '',
    endDate: '',
    monthlyValue: 0,
    adjustmentIndex: 'IGPM',
    lateFee: 10,
    status: 'ativo',
    clauses: DEFAULT_CLAUSES,
    inspection: []
  });

  const [activeTab, setActiveTab] = useState<'dados' | 'clausulas' | 'vistoria'>('dados');

  useEffect(() => {
    const unsubContracts = onSnapshot(collection(db, 'contracts'), (s) => {
      setContracts(s.docs.map(d => ({ id: d.id, ...d.data() } as Contract)));
      setLoading(false);
    }, (e) => {
      setLoading(false);
      handleFirestoreError(e, OperationType.LIST, 'contracts');
    });

    const unsubProperties = onSnapshot(collection(db, 'properties'), (s) => {
      setProperties(s.docs.map(d => ({ id: d.id, ...d.data() } as Property)));
    }, (e) => {
      setLoading(false);
      handleFirestoreError(e, OperationType.LIST, 'properties');
    });

    const unsubClients = onSnapshot(collection(db, 'clients'), (s) => {
      setClients(s.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
    }, (e) => {
      setLoading(false);
      handleFirestoreError(e, OperationType.LIST, 'clients');
    });

    return () => {
      unsubContracts();
      unsubProperties();
      unsubClients();
    };
  }, []);

  const handleStatusChange = async (contract: Contract, newStatus: ContractStatus) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'contracts', contract.id), { status: newStatus });
      
      // Update property status based on contract status
      if (newStatus === 'ativo') {
        await updateDoc(doc(db, 'properties', contract.propertyId), { status: 'alugado' });
      } else if (newStatus === 'encerrado' || newStatus === 'cancelado') {
        // Only set to available if no other active contract exists for this property
        const otherActive = contracts.find(c => c.propertyId === contract.propertyId && c.id !== contract.id && c.status === 'ativo');
        if (!otherActive) {
          await updateDoc(doc(db, 'properties', contract.propertyId), { status: 'disponivel' });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `contracts/${contract.id}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const { id, ...data } = formData as any;
      if (editingContract) {
        await updateDoc(doc(db, 'contracts', editingContract.id), data);
        
        // Update property status if status changed
        if (data.status !== editingContract.status) {
          if (data.status === 'ativo') {
            await updateDoc(doc(db, 'properties', data.propertyId), { status: 'alugado' });
          } else if (data.status === 'encerrado' || data.status === 'cancelado') {
            const otherActive = contracts.find(c => c.propertyId === data.propertyId && c.id !== editingContract.id && c.status === 'ativo');
            if (!otherActive) {
              await updateDoc(doc(db, 'properties', data.propertyId), { status: 'disponivel' });
            }
          }
        }
      } else {
        await addDoc(collection(db, 'contracts'), data);
        // Also update property status to 'alugado'
        if (data.propertyId) {
          await updateDoc(doc(db, 'properties', data.propertyId), { status: 'alugado' });
        }
      }
      setIsModalOpen(false);
      setEditingContract(null);
      setFormData({ 
        propertyId: '', 
        tenantId: '', 
        ownerId: '', 
        startDate: '', 
        endDate: '', 
        monthlyValue: 0, 
        adjustmentIndex: 'IGPM', 
        lateFee: 10, 
        status: 'ativo',
        clauses: DEFAULT_CLAUSES,
        inspection: []
      });
      setActiveTab('dados');
    } catch (err) {
      handleFirestoreError(err, editingContract ? OperationType.UPDATE : OperationType.CREATE, 'contracts');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    setContractToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!contractToDelete) return;
    try {
      const contract = contracts.find(c => c.id === contractToDelete);
      await deleteDoc(doc(db, 'contracts', contractToDelete));
      
      // If deleted contract was active, check if property should be available
      if (contract && contract.status === 'ativo') {
        const otherActive = contracts.find(c => c.propertyId === contract.propertyId && c.id !== contract.id && c.status === 'ativo');
        if (!otherActive) {
          await updateDoc(doc(db, 'properties', contract.propertyId), { status: 'disponivel' });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `contracts/${contractToDelete}`);
    } finally {
      setContractToDelete(null);
    }
  };

  const handleQuickAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (newTenantData.cpfCnpj && !isValidCpfCnpj(newTenantData.cpfCnpj)) {
      setTenantValidationError('CPF ou CNPJ inválido.');
      return;
    }
    setTenantValidationError(null);

    try {
      const dataToSave = { ...newTenantData };
      if (!dataToSave.email) delete dataToSave.email;

      const docRef = await addDoc(collection(db, 'clients'), dataToSave);
      setFormData({ ...formData, tenantId: docRef.id });
      setIsTenantModalOpen(false);
      setNewTenantData({ name: '', cpfCnpj: '', rg: '', phone: '', email: '', type: 'inquilino' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'clients');
    }
  };

  const generatePDF = (contract: Contract) => {
    const doc = new jsPDF();
    const property = properties.find(p => p.id === contract.propertyId);
    const tenant = clients.find(c => c.id === contract.tenantId);
    const owner = clients.find(c => c.id === contract.ownerId);

    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (margin * 2);
    let y = 20;

    const addText = (text: string, fontSize = 11, isBold = false, align: 'left' | 'center' | 'justify' = 'justify') => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      
      const paragraphs = text.split('\n');
      paragraphs.forEach(paragraph => {
        const lines = doc.splitTextToSize(paragraph, contentWidth);
        lines.forEach((line: string) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, align === 'center' ? pageWidth / 2 : margin, y, { align: align === 'center' ? 'center' : 'left' });
          y += fontSize * 0.4 + 2;
        });
        y += 2;
      });
    };

    // Header
    addText('CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL', 14, true, 'center');
    y += 10;

    // Parties
    const locadorText = `Locador ${owner?.name || '____________________'} portador da cédula de identidade RG ${owner?.rg || '____________________'} CPF ${owner?.cpfCnpj || '____________________'} Residente e domiciliado à ${owner?.address || '____________________'}.`;
    const locatarioText = `Locatário ${tenant?.name || '____________________'}, portador da cédula de identidade RG ${tenant?.rg || '____________________'}, CPF ${tenant?.cpfCnpj || '____________________'}.`;
    
    addText(locadorText);
    y += 2;
    addText(locatarioText);
    y += 10;

    // Clauses
    const clausesToUse = contract.clauses || DEFAULT_CLAUSES;
    
    clausesToUse.forEach((clause) => {
      // Replace placeholders
      let processedClause = clause
        .replaceAll('{ADDRESS}', property?.address || '____________________')
        .replaceAll('{DESCRIPTION}', property?.description || 'descrição não informada')
        .replaceAll('{START_DATE}', formatDate(contract.startDate))
        .replaceAll('{END_DATE}', formatDate(contract.endDate))
        .replaceAll('{MONTHLY_VALUE}', formatCurrency(contract.monthlyValue))
        .replaceAll('{ADJUSTMENT_INDEX}', contract.adjustmentIndex || 'IGPM')
        .replaceAll('{OWNER_CPF}', owner?.cpfCnpj || '____________________')
        .replaceAll('{OWNER_NAME}', owner?.name || '____________________')
        .replaceAll('{LATE_FEE}', (contract.lateFee || 10).toString());

      // Split title and content if newline exists (our new format)
      if (processedClause.includes('\n')) {
        const [title, ...contentParts] = processedClause.split('\n');
        const content = contentParts.join('\n').trim();
        addText(title.trim(), 11, true);
        addText(content);
      } else if (processedClause.includes(':')) {
        const [title, ...contentParts] = processedClause.split(':');
        const content = contentParts.join(':').trim();
        addText(title.trim(), 11, true);
        addText(content);
      } else {
        addText(processedClause);
      }
      y += 5;
    });

    // Signatures
    y += 20;
    if (y > 240) { doc.addPage(); y = 20; }
    
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    addText(today, 11, false, 'center');
    
    y += 30;
    
    // Owner Signature
    addText(owner?.name || '____________________', 11, false, 'center');
    addText(`CPF: ${owner?.cpfCnpj || '____________________'}`, 10, false, 'center');
    
    y += 20;
    if (y > 260) { doc.addPage(); y = 20; }

    // Tenant Signature
    addText(tenant?.name || '____________________', 11, false, 'center');
    addText(`CPF: ${tenant?.cpfCnpj || '____________________'}`, 10, false, 'center');

    // Inspection Report (Annex)
    if (contract.inspection && contract.inspection.length > 0) {
      doc.addPage();
      y = 20;
      addText('ANEXO I - TERMO DE VISTORIA DO IMÓVEL', 14, true, 'center');
      y += 10;
      addText(`Imóvel: ${property?.address || 'N/A'}`);
      addText(`Data da Vistoria: ${formatDate(new Date().toISOString())}`);
      y += 5;

      contract.inspection.forEach((item, index) => {
        if (y > 250) { doc.addPage(); y = 20; }
        addText(`${index + 1}. ${item.room}`, 11, true);
        addText(`Estado: ${item.condition}`);
        if (item.notes) addText(`Observações: ${item.notes}`);
        
        if (item.photos && item.photos.length > 0) {
          y += 2;
          let xOffset = margin;
          const imgSize = 40;
          
          item.photos.forEach((photo) => {
            if (xOffset + imgSize > pageWidth - margin) {
              xOffset = margin;
              y += imgSize + 5;
            }
            if (y + imgSize > 280) {
              doc.addPage();
              y = 20;
              xOffset = margin;
            }
            try {
              doc.addImage(photo, 'JPEG', xOffset, y, imgSize, imgSize);
              xOffset += imgSize + 5;
            } catch (e) {
              console.error("Error adding image to PDF", e);
            }
          });
          y += imgSize + 10;
        } else {
          y += 5;
        }
      });

      y += 20;
      if (y > 260) { doc.addPage(); y = 20; }
      addText('____________________________________', 11, false, 'center');
      addText('Assinatura do Locatário', 10, false, 'center');
    }

    doc.save(`contrato_${contract.id.slice(0, 8)}.pdf`);
  };

  const filteredContracts = contracts.filter(c => {
    const property = properties.find(p => p.id === c.propertyId);
    const tenant = clients.find(cl => cl.id === c.tenantId);
    return (
      property?.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const tenants = clients.filter(c => c.type === 'inquilino');
  const owners = clients.filter(c => c.type === 'proprietario');
  const availableProperties = properties.filter(p => p.status === 'disponivel' || (editingContract && p.id === editingContract.propertyId));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Contratos</h1>
          <p className="text-slate-400">Gestão de locações e termos</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setEditingContract(null);
              setFormData({ 
                propertyId: '', 
                tenantId: '', 
                ownerId: '', 
                startDate: '', 
                endDate: '', 
                monthlyValue: 0, 
                adjustmentIndex: 'IGPM', 
                lateFee: 10, 
                status: 'ativo',
                clauses: DEFAULT_CLAUSES,
                inspection: []
              });
              setActiveTab('dados');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus size={20} />
            Novo Contrato
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por imóvel ou inquilino..." 
          className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800/50 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Imóvel / Inquilino</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Vigência</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredContracts.map((contract) => {
                const property = properties.find(p => p.id === contract.propertyId);
                const tenant = clients.find(c => c.id === contract.tenantId);
                return (
                  <tr key={contract.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100 truncate max-w-xs">{property?.address || 'N/A'}</span>
                        <span className="text-sm text-slate-500">{tenant?.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Calendar size={14} className="text-slate-500" />
                        <span>{formatDate(contract.startDate)} - {formatDate(contract.endDate)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-blue-400">{formatCurrency(contract.monthlyValue)}</span>
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin ? (
                        <select
                          value={contract.status}
                          onChange={(e) => handleStatusChange(contract, e.target.value as ContractStatus)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-transparent border-none outline-none cursor-pointer focus:ring-1 focus:ring-blue-500",
                            contract.status === 'ativo' ? "bg-green-900/30 text-green-400" : 
                            contract.status === 'encerrado' ? "bg-slate-800 text-slate-500" : "bg-red-900/30 text-red-400"
                          )}
                        >
                          <option value="ativo" className="bg-slate-900 text-green-400">Ativo</option>
                          <option value="encerrado" className="bg-slate-900 text-slate-500">Encerrado</option>
                          <option value="cancelado" className="bg-slate-900 text-red-400">Cancelado</option>
                        </select>
                      ) : (
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                          contract.status === 'ativo' ? "bg-green-900/30 text-green-400" : 
                          contract.status === 'encerrado' ? "bg-slate-800 text-slate-500" : "bg-red-900/30 text-red-400"
                        )}>
                          {contract.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => generatePDF(contract)}
                          className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Gerar PDF"
                        >
                          <Download size={18} />
                        </button>
                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => {
                                setEditingContract(contract);
                                setFormData({
                                  ...contract,
                                  clauses: contract.clauses || DEFAULT_CLAUSES,
                                  inspection: contract.inspection || []
                                });
                                setActiveTab('dados');
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(contract.id)}
                              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold text-slate-100">{editingContract ? 'Editar Contrato' : 'Novo Contrato'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex border-b border-slate-800 bg-slate-800/30">
                <button
                  onClick={() => setActiveTab('dados')}
                  className={cn(
                    "flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors",
                    activeTab === 'dados' ? "text-blue-400 border-b-2 border-blue-400 bg-blue-400/5" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Dados Básicos
                </button>
                <button
                  onClick={() => setActiveTab('clausulas')}
                  className={cn(
                    "flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors",
                    activeTab === 'clausulas' ? "text-blue-400 border-b-2 border-blue-400 bg-blue-400/5" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Cláusulas
                </button>
                <button
                  onClick={() => setActiveTab('vistoria')}
                  className={cn(
                    "flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors",
                    activeTab === 'vistoria' ? "text-blue-400 border-b-2 border-blue-400 bg-blue-400/5" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Vistoria
                </button>
              </div>

              <form id="contract-form" onSubmit={handleSave} className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {activeTab === 'dados' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-400">Imóvel</label>
                        <select 
                          className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.propertyId}
                          onChange={(e) => {
                            const prop = properties.find(p => p.id === e.target.value);
                            setFormData({ ...formData, propertyId: e.target.value, ownerId: prop?.ownerId || '', monthlyValue: prop?.rentValue || 0 });
                          }}
                          required
                        >
                          <option value="">Selecione um imóvel</option>
                          {availableProperties.map(prop => (
                            <option key={prop.id} value={prop.id}>{prop.address} ({formatCurrency(prop.rentValue)})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-400 flex justify-between">
                          <span>Inquilino</span>
                          <button 
                            type="button"
                            onClick={() => setIsTenantModalOpen(true)}
                            className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
                          >
                            <Plus size={12} />
                            Novo Inquilino
                          </button>
                        </label>
                        <select 
                          className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.tenantId}
                          onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                          required
                        >
                          <option value="">Selecione um inquilino</option>
                          {tenants.map(tenant => (
                            <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-400">Data de Início</label>
                        <input 
                          type="date" 
                          className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-400">Data de Término</label>
                        <input 
                          type="date" 
                          className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-400">Valor Mensal (R$)</label>
                        <input 
                          type="number" 
                          className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.monthlyValue}
                          onChange={(e) => setFormData({ ...formData, monthlyValue: Number(e.target.value) })}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-400">Índice Reajuste</label>
                        <input 
                          type="text" 
                          className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.adjustmentIndex}
                          onChange={(e) => setFormData({ ...formData, adjustmentIndex: e.target.value })}
                          placeholder="Ex: IGPM"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-400">Multa Atraso (%)</label>
                        <input 
                          type="number" 
                          className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.lateFee}
                          onChange={(e) => setFormData({ ...formData, lateFee: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-400">Status do Contrato</label>
                      <select 
                        className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as ContractStatus })}
                        required
                      >
                        <option value="ativo">Ativo</option>
                        <option value="encerrado">Encerrado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeTab === 'clausulas' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-100">Cláusulas do Contrato</h3>
                      <button 
                        type="button"
                        onClick={() => setFormData({ ...formData, clauses: [...(formData.clauses || []), ''] })}
                        className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-400 font-semibold"
                      >
                        <Plus size={16} />
                        Adicionar Cláusula
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 italic">
                      Use placeholders: {'{ADDRESS}'}, {'{DESCRIPTION}'}, {'{START_DATE}'}, {'{END_DATE}'}, {'{MONTHLY_VALUE}'}, {'{ADJUSTMENT_INDEX}'}, {'{OWNER_CPF}'}, {'{OWNER_NAME}'}, {'{LATE_FEE}'}
                    </p>
                    <div className="space-y-4">
                      {(formData.clauses || []).map((clause, index) => (
                        <div key={index} className="relative group">
                          <textarea 
                            className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] text-sm"
                            value={clause}
                            onChange={(e) => {
                              const newClauses = [...(formData.clauses || [])];
                              newClauses[index] = e.target.value;
                              setFormData({ ...formData, clauses: newClauses });
                            }}
                            placeholder={`Cláusula ${index + 1}`}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const newClauses = (formData.clauses || []).filter((_, i) => i !== index);
                              setFormData({ ...formData, clauses: newClauses });
                            }}
                            className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'vistoria' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-100">Vistoria do Imóvel</h3>
                      <button 
                        type="button"
                        onClick={() => setFormData({ 
                          ...formData, 
                          inspection: [
                            ...(formData.inspection || []), 
                            { id: crypto.randomUUID(), room: '', condition: 'Bom', notes: '', photos: [] }
                          ] 
                        })}
                        className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-400 font-semibold"
                      >
                        <Plus size={16} />
                        Adicionar Item
                      </button>
                    </div>

                    <div className="space-y-6">
                      {(formData.inspection || []).map((item, index) => (
                        <div key={item.id} className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl space-y-4 relative group">
                          <button 
                            type="button"
                            onClick={() => {
                              const newInspection = (formData.inspection || []).filter((_, i) => i !== index);
                              setFormData({ ...formData, inspection: newInspection });
                            }}
                            className="absolute -top-2 -right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                          >
                            <Trash size={14} />
                          </button>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Cômodo / Área</label>
                              <input 
                                type="text" 
                                className="w-full p-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                                value={item.room}
                                onChange={(e) => {
                                  const newInspection = [...(formData.inspection || [])];
                                  newInspection[index] = { ...item, room: e.target.value };
                                  setFormData({ ...formData, inspection: newInspection });
                                }}
                                placeholder="Ex: Sala, Cozinha, Quarto 1..."
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Estado de Conservação</label>
                              <select 
                                className="w-full p-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                                value={item.condition}
                                onChange={(e) => {
                                  const newInspection = [...(formData.inspection || [])];
                                  newInspection[index] = { ...item, condition: e.target.value };
                                  setFormData({ ...formData, inspection: newInspection });
                                }}
                              >
                                <option value="Novo">Novo</option>
                                <option value="Bom">Bom</option>
                                <option value="Regular">Regular</option>
                                <option value="Ruim">Ruim</option>
                                <option value="Precisa de Reparo">Precisa de Reparo</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Observações</label>
                            <textarea 
                              className="w-full p-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]"
                              value={item.notes}
                              onChange={(e) => {
                                const newInspection = [...(formData.inspection || [])];
                                newInspection[index] = { ...item, notes: e.target.value };
                                setFormData({ ...formData, inspection: newInspection });
                              }}
                              placeholder="Detalhes sobre pintura, furos, manchas, etc..."
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Fotos da Vistoria</label>
                            <div className="flex flex-wrap gap-2">
                              {item.photos.map((photo, photoIndex) => (
                                <div key={photoIndex} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700">
                                  <img src={photo} alt="Vistoria" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newPhotos = item.photos.filter((_, i) => i !== photoIndex);
                                      const newInspection = [...(formData.inspection || [])];
                                      newInspection[index] = { ...item, photos: newPhotos };
                                      setFormData({ ...formData, inspection: newInspection });
                                    }}
                                    className="absolute top-0.5 right-0.5 p-0.5 bg-red-600 text-white rounded-full"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                              <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-lg hover:border-blue-500 hover:bg-blue-900/10 cursor-pointer transition-all">
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  multiple
                                  onChange={async (e) => {
                                    const files = Array.from(e.target.files || []);
                                    const base64s = await Promise.all(files.map(f => toBase64(f)));
                                    const newInspection = [...(formData.inspection || [])];
                                    newInspection[index] = { ...item, photos: [...item.photos, ...base64s] };
                                    setFormData({ ...formData, inspection: newInspection });
                                  }}
                                />
                                <Camera size={20} className="text-slate-500" />
                                <span className="text-[10px] text-slate-500 mt-1">Add</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}

                      {(formData.inspection || []).length === 0 && (
                        <div className="text-center py-12 bg-slate-800/20 border-2 border-dashed border-slate-800 rounded-2xl">
                          <ClipboardCheck size={48} className="mx-auto text-slate-700 mb-4" />
                          <p className="text-slate-500">Nenhum item de vistoria adicionado.</p>
                          <button 
                            type="button"
                            onClick={() => setFormData({ 
                              ...formData, 
                              inspection: [{ id: crypto.randomUUID(), room: '', condition: 'Bom', notes: '', photos: [] }] 
                            })}
                            className="mt-4 text-blue-500 hover:underline text-sm font-bold"
                          >
                            Começar Vistoria
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </form>

              <div className="p-6 border-t border-slate-800 flex gap-3">
                {editingContract && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      handleDelete(editingContract.id);
                    }}
                    className="py-3 px-4 bg-red-900/20 text-red-400 font-semibold rounded-xl hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={20} />
                    Excluir
                  </button>
                )}
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-800 text-slate-300 font-semibold rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  form="contract-form"
                  className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {editingContract ? 'Salvar Edição' : 'Salvar Contrato'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add Tenant Modal */}
      <AnimatePresence>
        {isTenantModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsTenantModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold text-slate-100">Novo Inquilino</h2>
                <button onClick={() => setIsTenantModalOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleQuickAddTenant} className="p-6 space-y-4">
                {tenantValidationError && (
                  <div className="p-3 bg-red-900/20 border border-red-800 rounded-xl text-red-400 text-sm font-medium flex items-center gap-2">
                    <X size={16} className="shrink-0" />
                    {tenantValidationError}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-400">Nome Completo</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newTenantData.name}
                    onChange={(e) => setNewTenantData({ ...newTenantData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">CPF / CNPJ</label>
                    <input 
                      type="text" 
                      className={cn(
                        "w-full p-3 bg-slate-800 border text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none",
                        tenantValidationError && newTenantData.cpfCnpj && !isValidCpfCnpj(newTenantData.cpfCnpj) ? "border-red-600" : "border-slate-700"
                      )}
                      value={newTenantData.cpfCnpj}
                      onChange={(e) => {
                        setNewTenantData({ ...newTenantData, cpfCnpj: e.target.value });
                        if (tenantValidationError) setTenantValidationError(null);
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-400">RG</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={newTenantData.rg}
                      onChange={(e) => setNewTenantData({ ...newTenantData, rg: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-400">Telefone</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newTenantData.phone}
                    onChange={(e) => setNewTenantData({ ...newTenantData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-400">E-mail</label>
                  <input 
                    type="email" 
                    className="w-full p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newTenantData.email}
                    onChange={(e) => setNewTenantData({ ...newTenantData, email: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsTenantModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-slate-800 text-slate-300 font-semibold rounded-xl hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Contrato"
        message="Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
};
