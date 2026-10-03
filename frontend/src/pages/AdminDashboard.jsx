import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  registerables,
} from 'chart.js';
import toast from 'react-hot-toast';
import {
  FiHome,
  FiSearch,
  FiBox,
  FiUsers,
  FiList,
  FiFileText,
  FiUser,
  FiBarChart2,
  FiLogOut,
  FiChevronLeft,
  FiChevronRight,
  FiMenu,
  FiBell,
  FiPlus,
  FiDownload,
  FiPrinter,
  FiEdit,
  FiTrash2,
  FiEye,
  FiCopy,
  FiCheck,
  FiX,
  FiClock,
  FiArrowLeft,
  FiTag,
  FiMapPin,
  FiCheckCircle,
  FiXCircle,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import {
  getAdminAnalytics,
  getAdminNotifications,
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getClaims,
  getClaimById,
  createClaim,
  updateClaimStatus,
  deleteClaim,
  getAllUsers,
  approveUser,
  rejectUser,
  deleteUser,
  getAdminList,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getImageUrl,
} from '../api';
import './AdminDashboard.css';

ChartJS.register(...registerables);

export default function AdminDashboard() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { user, logout, logoutUser } = useAuth();
  const [dataError, setDataError] = useState(null);

  // Active section
  const currentTab = tab || 'dashboard';

  // Layout UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationWrapperRef = useRef(null);

  // Common data
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [categories, setCategories] = useState([]);

  // Sub-view data & controls
  const [items, setItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);

  // Search & Filter & Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Forms
  const [lostFormOpen, setLostFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemFormData, setItemFormData] = useState({
    title: '',
    category: '',
    description: '',
    date: '',
    location: '',
    status: 'Pending',
    type: 'lost',
    imageFile: null,
  });

  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claimFormOpen, setClaimFormOpen] = useState(false);
  const [claimFormData, setClaimFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    itemName: '',
    additionalDetails: '',
    imageFile: null,
  });

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', description: '' });

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminFormData, setAdminFormData] = useState({ name: '', email: '', password: '' });

  // View details modal
  const [viewDetailsItem, setViewDetailsItem] = useState(null);

  // Reports selection
  const [reportType, setReportType] = useState('lost');

  // Chart refs
  const categoryChartRef = useRef(null);
  const weeklyChartRef = useRef(null);
  const locationChartRef = useRef(null);
  const statusChartRef = useRef(null);

  const categoryChartInstance = useRef(null);
  const weeklyChartInstance = useRef(null);
  const locationChartInstance = useRef(null);
  const statusChartInstance = useRef(null);

  // Close notifications on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        notificationWrapperRef.current &&
        !notificationWrapperRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial general data
  const fetchGeneralData = async () => {
    try {
      setDataError(null);
      const [analyticsRes, notifRes, catRes] = await Promise.allSettled([
        getAdminAnalytics(),
        getAdminNotifications(),
        getCategories(),
      ]);
      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data);
      } else {
        console.warn('Admin analytics could not be loaded:', analyticsRes.reason);
      }
      if (notifRes.status === 'fulfilled') {
        setNotifications(Array.isArray(notifRes.value.data) ? notifRes.value.data : []);
      }
      if (catRes.status === 'fulfilled') {
        setCategories(Array.isArray(catRes.value.data) ? catRes.value.data : []);
      }
      if (analyticsRes.status === 'rejected' && notifRes.status === 'rejected' && catRes.status === 'rejected') {
        setDataError('Unable to load dashboard data.');
      }
    } catch (err) {
      console.error('Failed to load admin overview data:', err);
      setDataError('Unable to load dashboard data.');
    }
  };

  // Fetch section-specific data
  const fetchSectionData = async () => {
    setLoading(true);
    try {
      if (currentTab === 'dashboard') {
        await fetchGeneralData();
      } else if (currentTab === 'lost-items' || currentTab === 'found-items') {
        const type = currentTab === 'lost-items' ? 'lost' : 'found';
        const res = await getAllItems({ limit: 100, type });
        setItems(res.data.items || []);
      } else if (currentTab === 'claim-requests') {
        const res = await getClaims({ limit: 100 });
        setClaims(res.data.claims || []);
      } else if (currentTab === 'categories') {
        const res = await getCategories();
        setCategories(res.data);
      } else if (currentTab === 'users') {
        const res = await getAllUsers();
        setUsers(res.data || []);
      } else if (currentTab === 'admins') {
        const res = await getAdminList();
        setAdmins(res.data || []);
      } else if (currentTab === 'reports') {
        const [itemsRes, claimsRes, usersRes, catRes] = await Promise.all([
          getAllItems({ limit: 200 }),
          getClaims({ limit: 200 }),
          getAllUsers(),
          getCategories(),
        ]);
        setItems(itemsRes.data.items || []);
        setClaims(claimsRes.data.claims || []);
        setUsers(usersRes.data || []);
        setCategories(catRes.data || []);
      }
    } catch (err) {
      toast.error('Failed to load page data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset search and page on tab change
    setSearchTerm('');
    setSearchField('all');
    setCurrentPage(1);
    setStatusFilter('all');
    setLostFormOpen(false);
    setClaimFormOpen(false);
    fetchGeneralData();
    fetchSectionData();
  }, [currentTab]);

  // Render Charts when on dashboard and analytics is loaded
  useEffect(() => {
    if (currentTab !== 'dashboard' || !analytics) return;

    try {
      // Cleanup existing charts
      if (categoryChartInstance.current) {
        categoryChartInstance.current.destroy();
        categoryChartInstance.current = null;
      }
      if (weeklyChartInstance.current) {
        weeklyChartInstance.current.destroy();
        weeklyChartInstance.current = null;
      }
      if (locationChartInstance.current) {
        locationChartInstance.current.destroy();
        locationChartInstance.current = null;
      }
      if (statusChartInstance.current) {
        statusChartInstance.current.destroy();
        statusChartInstance.current = null;
      }

      const colorPalette = {
        primary: ['#3498db', '#2980b9', '#1f618d', '#154360', '#5dade2', '#85c1e9'],
        status: ['#f39c12', '#2ecc71', '#e74c3c', '#9b59b6', '#34495e'],
        accent: ['#9b59b6', '#8e44ad', '#7d3c98', '#6c3483'],
      };

      // 1. Category Chart
      if (categoryChartRef.current) {
        const catLabels =
          analytics.category_data && analytics.category_data.length > 0
            ? analytics.category_data.map((c) => c.category_name)
            : ['No Data'];
        const catCounts =
          analytics.category_data && analytics.category_data.length > 0
            ? analytics.category_data.map((c) => c.item_count)
            : [0];

        categoryChartInstance.current = new ChartJS(categoryChartRef.current, {
          type: 'doughnut',
          data: {
            labels: catLabels,
            datasets: [
              {
                data: catCounts,
                backgroundColor: colorPalette.primary,
                borderColor: '#ffffff',
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right' },
            },
            cutout: '55%',
          },
        });
      }

      // 2. Weekly Activity Chart
      if (weeklyChartRef.current) {
        const weeklyData = Array.isArray(analytics.weekly_data) ? analytics.weekly_data : [];
        const weeklyLabels =
          weeklyData.length > 0
            ? weeklyData.map((w) => w.date)
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const weeklyCounts =
          weeklyData.length > 0
            ? weeklyData.map((w) => w.total_reports || 0)
            : [0, 0, 0, 0, 0, 0, 0];

        weeklyChartInstance.current = new ChartJS(weeklyChartRef.current, {
          type: 'bar',
          data: {
            labels: weeklyLabels,
            datasets: [
              {
                label: 'New Reports',
                data: weeklyCounts,
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1,
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: { precision: 0 },
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
              },
              x: { grid: { display: false } },
            },
            plugins: { legend: { display: false } },
          },
        });
      }

      // 3. Top Locations Chart
      if (locationChartRef.current) {
        const locLabels =
          analytics.location_data && analytics.location_data.length > 0
            ? analytics.location_data.map((l) => l.location_lost)
            : ['No Reports'];
        const locCounts =
          analytics.location_data && analytics.location_data.length > 0
            ? analytics.location_data.map((l) => l.report_count)
            : [0];

        locationChartInstance.current = new ChartJS(locationChartRef.current, {
          type: 'bar',
          data: {
            labels: locLabels,
            datasets: [
              {
                label: 'Reports',
                data: locCounts,
                backgroundColor: '#9b59b6',
                borderColor: '#8e44ad',
                borderWidth: 1,
                borderRadius: 4,
              },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                beginAtZero: true,
                ticks: { precision: 0 },
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
              },
              y: { grid: { display: false } },
            },
            plugins: { legend: { display: false } },
          },
        });
      }

      // 4. Status Distribution Chart
      if (statusChartRef.current) {
        const statusEntries = Object.entries(analytics.status_data || {});
        const statusLabels =
          statusEntries.length > 0 ? statusEntries.map(([k]) => k) : ['No Data'];
        const statusCounts =
          statusEntries.length > 0 ? statusEntries.map(([, v]) => v) : [0];

        statusChartInstance.current = new ChartJS(statusChartRef.current, {
          type: 'polarArea',
          data: {
            labels: statusLabels,
            datasets: [
              {
                data: statusCounts,
                backgroundColor: colorPalette.status,
                borderColor: '#ffffff',
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right' },
            },
          },
        });
      }
    } catch (chartErr) {
      console.error('Error rendering dashboard charts:', chartErr);
    }

    return () => {
      if (categoryChartInstance.current) {
        categoryChartInstance.current.destroy();
        categoryChartInstance.current = null;
      }
      if (weeklyChartInstance.current) {
        weeklyChartInstance.current.destroy();
        weeklyChartInstance.current = null;
      }
      if (locationChartInstance.current) {
        locationChartInstance.current.destroy();
        locationChartInstance.current = null;
      }
      if (statusChartInstance.current) {
        statusChartInstance.current.destroy();
        statusChartInstance.current = null;
      }
    };
  }, [currentTab, analytics]);

  // Navigation handlers
  const handleNav = (targetTab) => {
    navigate(`/admin/${targetTab}`);
    if (window.innerWidth < 992) {
      setMobileSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    if (typeof logout === 'function') logout();
    else if (typeof logoutUser === 'function') logoutUser();
    navigate('/', { replace: true });
  };

  // Export to CSV
  const handleExportCSV = (dataToExport, filename) => {
    if (!dataToExport || dataToExport.length === 0) {
      toast.error('No data available to export');
      return;
    }
    const headers = Object.keys(dataToExport[0]).join(',');
    const rows = dataToExport.map((row) =>
      Object.values(row)
        .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Data exported successfully');
  };

  // Print friendly view
  const handlePrint = () => {
    window.print();
  };

  // CRUD for Lost / Found Items
  const handleOpenAddLost = () => {
    setEditingItem(null);
    setItemFormData({
      title: '',
      category: categories[0]?.name || 'Electronics',
      description: '',
      date: new Date().toISOString().slice(0, 10),
      location: '',
      status: 'Pending',
      type: currentTab === 'found-items' ? 'found' : 'lost',
      imageFile: null,
    });
    setLostFormOpen(true);
  };

  const handleOpenItemDetails = async (item) => {
    try {
      const res = await getItemById(item._id);
      setViewDetailsItem(res.data);
    } catch {
      setViewDetailsItem(item);
    }
  };

  const handleOpenEditItem = (item) => {
    setEditingItem(item);
    setItemFormData({
      title: item.title || '',
      category: item.category || (categories[0]?.name || 'Electronics'),
      description: item.description || '',
      date: item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
      location: item.location || '',
      status: item.status || 'Pending',
      type: item.type || 'lost',
      imageFile: null,
    });
    setLostFormOpen(true);
  };

  const handleDuplicateItem = (item) => {
    setEditingItem(null);
    setItemFormData({
      title: `${item.title} (Copy)`,
      category: item.category || '',
      description: item.description || '',
      date: new Date().toISOString().slice(0, 10),
      location: item.location || '',
      status: 'Pending',
      type: item.type || 'lost',
      imageFile: null,
    });
    setLostFormOpen(true);
  };

  const handleSaveItem = async (e, goBackToList = false) => {
    if (e) e.preventDefault();
    if (!itemFormData.title || !itemFormData.category || !itemFormData.location || !itemFormData.date) {
      toast.error('Please fill all required fields marked with *');
      return;
    }

    const formData = new FormData();
    formData.append('title', itemFormData.title);
    formData.append('category', itemFormData.category);
    formData.append('description', itemFormData.description || '');
    formData.append('location', itemFormData.location);
    formData.append('date', itemFormData.date);
    formData.append('status', itemFormData.status);
    formData.append('type', itemFormData.type);
    if (itemFormData.imageFile) {
      formData.append('image', itemFormData.imageFile);
    }

    try {
      if (editingItem) {
        await updateItem(editingItem._id, formData);
        toast.success('Your data has been successfully stored into the database.');
      } else {
        await createItem(formData);
        toast.success('Your data has been successfully stored into the database.');
      }
      fetchSectionData();
      fetchGeneralData();
      if (goBackToList) {
        setLostFormOpen(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving item');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteItem(id);
      toast.success('Item deleted successfully');
      setItems((prev) => prev.filter((i) => i._id !== id));
      fetchGeneralData();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  // Claim Requests Operations
  const handleOpenClaimDetails = async (claim) => {
    try {
      const res = await getClaimById(claim._id);
      setSelectedClaim(res.data);
      setClaimModalOpen(true);
    } catch {
      setSelectedClaim(claim);
      setClaimModalOpen(true);
    }
  };

  const handleUpdateClaimStatus = async (id, status) => {
    try {
      const res = await updateClaimStatus(id, status);
      toast.success(`Claim request ${status} successfully`);
      setClaims((prev) => prev.map((c) => (c._id === id ? res.data : c)));
      if (selectedClaim && selectedClaim._id === id) {
        setSelectedClaim(res.data);
      }
      fetchGeneralData();
    } catch (err) {
      toast.error('Status update failed');
    }
  };

  const handleDeleteClaim = async (id) => {
    if (!window.confirm('Delete this claim request?')) return;
    try {
      await deleteClaim(id);
      toast.success('Claim deleted successfully');
      setClaims((prev) => prev.filter((c) => c._id !== id));
      fetchGeneralData();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleSaveClaim = async (e) => {
    e.preventDefault();
    if (!claimFormData.fullName || !claimFormData.email || !claimFormData.phone) {
      toast.error('Please enter Name, Email, and Phone');
      return;
    }

    const formData = new FormData();
    formData.append('fullName', claimFormData.fullName);
    formData.append('email', claimFormData.email);
    formData.append('phone', claimFormData.phone);
    formData.append('itemName', claimFormData.itemName || 'Unspecified Item');
    formData.append('additionalDetails', claimFormData.additionalDetails || '');
    if (claimFormData.imageFile) {
      formData.append('image', claimFormData.imageFile);
    }

    try {
      await createClaim(formData);
      toast.success('Your data has been successfully stored into the database.');
      setClaimFormOpen(false);
      fetchSectionData();
      fetchGeneralData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error submitting claim');
    }
  };

  // Categories CRUD
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({ name: '', description: '' });
    setCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryFormData({ name: cat.name, description: cat.description || '' });
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryFormData.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    try {
      if (editingCategory) {
        await updateCategory(editingCategory._id, categoryFormData);
        toast.success('Category updated successfully');
      } else {
        await createCategory(categoryFormData);
        toast.success('Category added successfully');
      }
      setCategoryModalOpen(false);
      fetchSectionData();
      fetchGeneralData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Category operation failed');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await deleteCategory(id);
      toast.success('Category deleted');
      setCategories((prev) => prev.filter((c) => c._id !== id));
    } catch {
      toast.error('Delete failed');
    }
  };

  // Admin Users CRUD
  const handleOpenAddAdmin = () => {
    setEditingAdmin(null);
    setAdminFormData({ name: '', email: '', password: '' });
    setAdminModalOpen(true);
  };

  const handleOpenEditAdmin = (admin) => {
    setEditingAdmin(admin);
    setAdminFormData({ name: admin.name, email: admin.email, password: '' });
    setAdminModalOpen(true);
  };

  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    if (!adminFormData.name || !adminFormData.email) {
      toast.error('Name and email are required');
      return;
    }
    if (!editingAdmin && (!adminFormData.password || adminFormData.password.length < 6)) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      if (editingAdmin) {
        await updateAdminUser(editingAdmin._id, adminFormData);
        toast.success('Admin updated successfully');
      } else {
        await createAdminUser(adminFormData);
        toast.success('Admin user created successfully');
      }
      setAdminModalOpen(false);
      fetchSectionData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDeleteAdmin = async (id, email) => {
    if (email === 'admin@apsit.edu.in') {
      toast.error('The dedicated primary admin account (admin@apsit.edu.in) cannot be deleted.');
      return;
    }
    if (!window.confirm('Delete this admin user?')) return;
    try {
      await deleteAdminUser(id);
      toast.success('Admin user deleted');
      setAdmins((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  // Student Users Approval Workflow
  const handleApproveStudent = async (id) => {
    try {
      const res = await approveUser(id);
      const updated = res.data.student || res.data.user;
      if (res.data.emailSent) {
        toast.success('Student account approved! Approval email sent.');
      } else {
        toast.error('Student account was approved, but the approval email could not be sent.');
      }
      if (updated) {
        setUsers((prev) => prev.map((u) => (u._id === id ? updated : u)));
      }
      fetchGeneralData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    }
  };

  const handleRejectStudent = async (id) => {
    try {
      const res = await rejectUser(id);
      const updated = res.data.student || res.data.user;
      if (res.data.emailSent) {
        toast.success('Student account rejected. Notification email sent.');
      } else {
        toast.error('Student account was rejected, but the rejection email could not be sent.');
      }
      if (updated) {
        setUsers((prev) => prev.map((u) => (u._id === id ? updated : u)));
      }
      fetchGeneralData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    }
  };

  const handleDeleteUserAccount = async (id) => {
    if (!window.confirm('Delete this user and all their reported items?')) return;
    try {
      await deleteUser(id);
      toast.success('User deleted successfully');
      setUsers((prev) => prev.filter((u) => u._id !== id));
      fetchGeneralData();
    } catch {
      toast.error('Delete failed');
    }
  };

  // Filter & Pagination logic for current table
  const getFilteredData = () => {
    let list = [];
    if (currentTab === 'lost-items') {
      list = items.filter((i) => i.type === 'lost');
    } else if (currentTab === 'found-items') {
      list = items.filter((i) => i.type === 'found');
    } else if (currentTab === 'claim-requests') {
      list = [...claims];
    } else if (currentTab === 'users') {
      list = users.filter((u) => u.role !== 'admin');
    } else if (currentTab === 'admins') {
      list = [...admins];
    } else if (currentTab === 'categories') {
      list = [...categories];
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((item) => {
        const s = (item.status || '').toLowerCase();
        return s === statusFilter.toLowerCase();
      });
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((item) => {
        if (searchField === 'all') {
          return Object.values(item).some((v) =>
            typeof v === 'string' ? v.toLowerCase().includes(q) : false
          );
        } else if (item[searchField]) {
          return String(item[searchField]).toLowerCase().includes(q);
        }
        return false;
      });
    }

    return list;
  };

  const filteredData = getFilteredData();
  const totalEntries = filteredData.length;
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="admin-layout-root">
      {/* 1. Permanent Left Sidebar */}
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`} id="sidebar">
        <div className="sidebar-logo-section">
          <FiBox className="sidebar-logo-icon" />
          <h4 className="sidebar-logo-text">Lost&amp;Found</h4>
        </div>

        <nav className="sidebar-nav-container">
          <button
            className={`sidebar-nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNav('dashboard')}
          >
            <FiHome className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Dashboard</span>
          </button>

          <button
            className={`sidebar-nav-item ${currentTab === 'lost-items' ? 'active' : ''}`}
            onClick={() => handleNav('lost-items')}
          >
            <FiSearch className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Lost Items</span>
          </button>

          <button
            className={`sidebar-nav-item ${currentTab === 'found-items' ? 'active' : ''}`}
            onClick={() => handleNav('found-items')}
          >
            <FiBox className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Found Items</span>
          </button>

          <button
            className={`sidebar-nav-item ${currentTab === 'admins' ? 'active' : ''}`}
            onClick={() => handleNav('admins')}
          >
            <FiUsers className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Admins</span>
          </button>

          <button
            className={`sidebar-nav-item ${currentTab === 'categories' ? 'active' : ''}`}
            onClick={() => handleNav('categories')}
          >
            <FiList className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Categories</span>
          </button>

          <button
            className={`sidebar-nav-item ${currentTab === 'claim-requests' ? 'active' : ''}`}
            onClick={() => handleNav('claim-requests')}
          >
            <FiFileText className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Claim Requests</span>
            {analytics?.pending_claims > 0 && !sidebarCollapsed && (
              <span className="badge-pill" style={{ background: '#e74c3c', color: '#fff', borderRadius: '10px', padding: '2px 7px', fontSize: '11px', fontWeight: 'bold', marginLeft: 'auto' }}>
                {analytics.pending_claims}
              </span>
            )}
          </button>

          <button
            className={`sidebar-nav-item ${currentTab === 'users' ? 'active' : ''}`}
            onClick={() => handleNav('users')}
          >
            <FiUser className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Users</span>
            {analytics?.pending_users > 0 && !sidebarCollapsed && (
              <span className="badge-pill" style={{ background: '#f39c12', color: '#fff', borderRadius: '10px', padding: '2px 7px', fontSize: '11px', fontWeight: 'bold', marginLeft: 'auto' }}>
                {analytics.pending_users}
              </span>
            )}
          </button>

          <button
            className={`sidebar-nav-item ${currentTab === 'reports' ? 'active' : ''}`}
            onClick={() => handleNav('reports')}
          >
            <FiBarChart2 className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Reports</span>
          </button>

          <button className="sidebar-nav-item" onClick={handleLogout}>
            <FiLogOut className="sidebar-nav-icon" />
            <span className="sidebar-nav-text">Logout</span>
          </button>
        </nav>

        <button
          className="sidebar-toggle-btn"
          id="toggleSidebar"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title="Toggle sidebar"
        >
          {sidebarCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
      </aside>

      {/* 2. Main Content Area */}
      <div className={`admin-main-content ${sidebarCollapsed ? 'expanded' : ''}`} id="mainContent">
        {/* Top Navbar */}
        <header className="admin-top-navbar">
          <div className="navbar-left">
            <button
              className="mobile-toggle-btn"
              id="mobileToggle"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            >
              <FiMenu />
            </button>
            <h5 className="welcome-text">
              Welcome, {user?.name || 'admin'}
            </h5>
          </div>

          <div className="navbar-right">
            {/* Notification Bell & Dropdown */}
            <div className="notification-wrapper" ref={notificationWrapperRef}>
              <button
                type="button"
                className="notification-icon-btn"
                id="notificationBell"
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
              >
                <FiBell />
                {notifications.length > 0 && (
                  <span className="notification-badge" id="notificationCount">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-dropdown" id="notificationMenu">
                  <div className="notification-header">
                    <span>Notifications</span>
                    <small>{notifications.length} recent</small>
                  </div>
                  <ul className="notification-list">
                    {notifications.length === 0 ? (
                      <li className="notification-item" style={{ color: '#888' }}>
                        No recent notifications
                      </li>
                    ) : (
                      notifications.map((n) => (
                        <li
                          key={n.id}
                          className="notification-item"
                          onClick={() => {
                            setShowNotifications(false);
                            if (n.link) navigate(n.link);
                          }}
                        >
                          <div style={{ marginTop: '2px' }}>
                            {n.type === 'claim' && <FiFileText style={{ color: '#3498db' }} />}
                            {n.type === 'lost_item' && <FiSearch style={{ color: '#e67e22' }} />}
                            {n.type === 'found_item' && <FiBox style={{ color: '#2ecc71' }} />}
                            {n.type === 'student_registration' && <FiUser style={{ color: '#9b59b6' }} />}
                          </div>
                          <div className="notification-item-content">
                            <div>
                              <strong>{n.type === 'claim' ? 'New claim by ' : n.type === 'lost_item' ? 'New lost item: ' : n.type === 'found_item' ? 'New found item: ' : 'New student: '}</strong>
                              {n.title}
                            </div>
                            <span className="notification-time">
                              {new Date(n.created_at).toLocaleString()}
                            </span>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                  <div
                    className="notification-view-all"
                    onClick={() => {
                      setShowNotifications(false);
                      handleNav('reports');
                    }}
                  >
                    View All
                  </div>
                </div>
              )}
            </div>

            <button className="admin-logout-btn" onClick={handleLogout}>
              <FiLogOut /> Logout
            </button>
          </div>
        </header>

        {/* Dynamic Content Views */}
        <main className="admin-content-area">
          {/* ========================================================
              VIEW 1: DASHBOARD OVERVIEW
             ======================================================== */}
          {currentTab === 'dashboard' && (
            <div>
              <div className="overview-intro-card">
                <h3>Dashboard Overview</h3>
                <p>
                  Welcome to the Lost &amp; Found Admin Panel. Here you can manage all system data and analytics.
                </p>
                {dataError && (
                  <div style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171', padding: '10px 14px', borderRadius: '6px', margin: '12px 0', fontSize: '14px' }}>
                    {dataError}
                  </div>
                )}

                <div className="admin-stats-grid">
                  <div className="admin-stat-card bg-primary-light">
                    <FiSearch className="admin-stat-icon" />
                    <div className="admin-stat-val">{analytics?.total_lost ?? 0}</div>
                    <p className="admin-stat-label">Pending Lost Items</p>
                  </div>

                  <div className="admin-stat-card bg-success-light">
                    <FiBox className="admin-stat-icon" />
                    <div className="admin-stat-val">{analytics?.total_found ?? 0}</div>
                    <p className="admin-stat-label">Found Items</p>
                  </div>

                  <div className="admin-stat-card bg-warning-light">
                    <FiFileText className="admin-stat-icon" />
                    <div className="admin-stat-val">{analytics?.total_claims ?? 0}</div>
                    <p className="admin-stat-label">Claim Requests</p>
                  </div>

                  <div className="admin-stat-card bg-purple-light">
                    <FiUsers className="admin-stat-icon" />
                    <div className="admin-stat-val">{analytics?.pending_users ?? 0}</div>
                    <p className="admin-stat-label">Pending Student Verifications</p>
                  </div>
                </div>
              </div>

              {/* 2x2 Analytics Grid */}
              <div className="admin-charts-grid">
                <div className="admin-chart-card">
                  <h3>Reports by Category</h3>
                  <div className="admin-chart-canvas-wrap">
                    <canvas ref={categoryChartRef} id="categoryChart"></canvas>
                  </div>
                </div>

                <div className="admin-chart-card">
                  <h3>Last 7 Days Activity</h3>
                  <div className="admin-chart-canvas-wrap">
                    <canvas ref={weeklyChartRef} id="weeklyChart"></canvas>
                  </div>
                </div>
              </div>

              <div className="admin-charts-grid">
                <div className="admin-chart-card">
                  <h3>Top 4 Locations Reported</h3>
                  <div className="admin-chart-canvas-wrap">
                    <canvas ref={locationChartRef} id="locationChart"></canvas>
                  </div>
                </div>

                <div className="admin-chart-card">
                  <h3>Status Distribution</h3>
                  <div className="admin-chart-canvas-wrap">
                    <canvas ref={statusChartRef} id="statusChart"></canvas>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 2: LOST ITEMS / FOUND ITEMS
             ======================================================== */}
          {(currentTab === 'lost-items' || currentTab === 'found-items') && (
            <div className="crud-page-container">
              {/* Form sub-view if Add/Edit is opened */}
              {lostFormOpen ? (
                <div className="admin-form-container">
                  <h3 className="admin-form-title">
                    {editingItem ? 'EDIT ITEM' : currentTab === 'found-items' ? 'ADD FOUND ITEM' : 'ADD LOST ITEM'}
                  </h3>

                  <form onSubmit={(e) => handleSaveItem(e, false)}>
                    <div className="form-group-row">
                      <label className="form-label-bold">
                        Item name <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control-input"
                        placeholder="e.g. Blue Dell Laptop Charger"
                        value={itemFormData.title}
                        onChange={(e) => setItemFormData({ ...itemFormData, title: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group-row">
                      <label className="form-label-bold">
                        Category <span className="required-star">*</span>
                      </label>
                      <select
                        className="form-control-select"
                        value={itemFormData.category}
                        onChange={(e) => setItemFormData({ ...itemFormData, category: e.target.value })}
                        required
                      >
                        <option value="">Select category...</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group-row">
                      <label className="form-label-bold">Description</label>
                      <textarea
                        className="form-control-textarea"
                        placeholder="Provide item details, distinctive marks, color, brand..."
                        value={itemFormData.description}
                        onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                      ></textarea>
                    </div>

                    <div className="form-group-row">
                      <label className="form-label-bold">
                        {currentTab === 'found-items' ? 'Date found' : 'Date lost'}{' '}
                        <span className="required-star">*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control-input"
                        value={itemFormData.date}
                        onChange={(e) => setItemFormData({ ...itemFormData, date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group-row">
                      <label className="form-label-bold">
                        {currentTab === 'found-items' ? 'Location found' : 'Location lost'}{' '}
                        <span className="required-star">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control-input"
                        placeholder="e.g. Library 2nd Floor, Room 304, Canteen"
                        value={itemFormData.location}
                        onChange={(e) => setItemFormData({ ...itemFormData, location: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group-row">
                      <label className="form-label-bold">Image</label>
                      <input
                        type="file"
                        className="form-file-input"
                        accept="image/*"
                        onChange={(e) => setItemFormData({ ...itemFormData, imageFile: e.target.files[0] })}
                      />
                    </div>

                    <div className="form-group-row">
                      <label className="form-label-bold">Status</label>
                      <select
                        className="form-control-select"
                        value={itemFormData.status}
                        onChange={(e) => setItemFormData({ ...itemFormData, status: e.target.value })}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Found">Found</option>
                        <option value="Claimed">Claimed</option>
                      </select>
                    </div>

                    <div className="form-buttons-row">
                      <button type="submit" className="btn-form-save">
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn-form-save-back"
                        onClick={(e) => handleSaveItem(e, true)}
                      >
                        Save and go back to list
                      </button>
                      <button
                        type="button"
                        className="btn-form-cancel"
                        onClick={() => setLostFormOpen(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  {/* Top action area matching reference */}
                  <div className="crud-header-actions">
                    <div>
                      {currentTab === 'lost-items' && (
                        <button className="crud-btn-primary" onClick={handleOpenAddLost}>
                          <FiPlus /> Add Lost Item
                        </button>
                      )}
                      {currentTab === 'found-items' && (
                        <button className="crud-btn-primary" onClick={handleOpenAddLost}>
                          <FiPlus /> Add Found Item
                        </button>
                      )}
                    </div>

                    <div className="crud-tools-right">
                      <button
                        className="crud-tool-btn"
                        onClick={() =>
                          handleExportCSV(
                            items.map((i) => ({
                              Name: i.title,
                              Category: i.category,
                              Description: i.description,
                              Date: i.date ? new Date(i.date).toLocaleDateString() : '',
                              Location: i.location,
                              Status: i.status,
                            })),
                            currentTab === 'lost-items' ? 'lost_items' : 'found_items'
                          )
                        }
                      >
                        <FiDownload /> Export
                      </button>
                      <button className="crud-tool-btn" onClick={handlePrint}>
                        <FiPrinter /> Print
                      </button>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="table-responsive-wrapper">
                    <table className="admin-crud-table">
                      <thead>
                        <tr>
                          <th>ITEM NAME</th>
                          {currentTab === 'lost-items' && <th>CATEGORY</th>}
                          <th>DESCRIPTION</th>
                          <th>{currentTab === 'lost-items' ? 'DATE LOST' : 'DATE FOUND'}</th>
                          <th>LOCATION</th>
                          {currentTab === 'found-items' && <th>IMAGE</th>}
                          <th>STATUS</th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.length === 0 ? (
                          <tr>
                            <td colSpan={currentTab === 'found-items' ? 7 : 7} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                              No records found.
                            </td>
                          </tr>
                        ) : (
                          paginatedData.map((item) => (
                            <tr key={item._id}>
                              <td style={{ fontWeight: 600 }}>{item.title}</td>
                              {currentTab === 'lost-items' && <td>{item.category}</td>}
                              <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.description || '—'}
                              </td>
                              <td>{item.date ? new Date(item.date).toLocaleDateString() : '—'}</td>
                              <td>{item.location}</td>
                              {currentTab === 'found-items' && (
                                <td>
                                  {item.image ? (
                                    <>
                                      <img
                                        src={getImageUrl(item.image)}
                                        alt={item.title}
                                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          if (e.currentTarget.nextElementSibling) {
                                            e.currentTarget.nextElementSibling.style.display = 'inline';
                                          }
                                        }}
                                      />
                                      <span style={{ color: '#aaa', fontSize: '11px', display: 'none' }}>No image</span>
                                    </>
                                  ) : (
                                    <span style={{ color: '#aaa', fontSize: '11px' }}>No image</span>
                                  )}
                                </td>
                              )}
                              <td>
                                <span className={`status-pill ${(item.status || 'pending').toLowerCase()}`}>
                                  {item.status || 'Pending'}
                                </span>
                              </td>
                              <td>
                                <div className="action-buttons-group">
                                  <button
                                    className="action-icon-btn action-icon-view"
                                    title="View"
                                    onClick={() => handleOpenItemDetails(item)}
                                  >
                                    <FiEye />
                                  </button>
                                  <button
                                    className="action-icon-btn action-icon-edit"
                                    title="Edit"
                                    onClick={() => handleOpenEditItem(item)}
                                  >
                                    <FiEdit />
                                  </button>
                                  <button
                                    className="action-icon-btn action-icon-copy"
                                    title="Duplicate / Copy"
                                    onClick={() => handleDuplicateItem(item)}
                                  >
                                    <FiCopy />
                                  </button>
                                  <button
                                    className="action-icon-btn action-icon-delete"
                                    title="Delete"
                                    onClick={() => handleDeleteItem(item._id)}
                                  >
                                    <FiTrash2 />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom Search & Filter Bar */}
                  <div className="crud-bottom-bar">
                    <div className="crud-search-block">
                      <span className="crud-search-label">Search:</span>
                      <input
                        type="text"
                        className="crud-search-input"
                        placeholder="Type to search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <select
                        className="crud-search-select"
                        value={searchField}
                        onChange={(e) => setSearchField(e.target.value)}
                      >
                        <option value="all">Search all</option>
                        <option value="title">Item Name</option>
                        <option value="category">Category</option>
                        <option value="location">Location</option>
                        <option value="status">Status</option>
                      </select>
                      <button
                        className="crud-btn-search"
                        onClick={() => setCurrentPage(1)}
                      >
                        Search
                      </button>
                      <button
                        className="crud-btn-clear"
                        onClick={() => {
                          setSearchTerm('');
                          setSearchField('all');
                          setCurrentPage(1);
                        }}
                      >
                        Clear filtering
                      </button>
                    </div>

                    <div className="crud-pagination-block">
                      <span className="crud-page-info">
                        Showing {totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                        {Math.min(currentPage * pageSize, totalEntries)} of {totalEntries} entries
                      </span>
                      <div className="crud-pagination-nav">
                        <button
                          className="crud-page-btn"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(1)}
                        >
                          First
                        </button>
                        <button
                          className="crud-page-btn"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => p - 1)}
                        >
                          Previous
                        </button>
                        <button className="crud-page-btn active">{currentPage}</button>
                        <button
                          className="crud-page-btn"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => p + 1)}
                        >
                          Next
                        </button>
                        <button
                          className="crud-page-btn"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ========================================================
              VIEW 3: CLAIM REQUESTS
             ======================================================== */}
          {currentTab === 'claim-requests' && (
            <div className="crud-page-container">
              {claimFormOpen ? (
                <div className="admin-form-container">
                  <h3 className="admin-form-title">ADD CLAIM REQUEST</h3>
                  <form onSubmit={handleSaveClaim}>
                    <div className="form-group-row">
                      <label className="form-label-bold">Full Name <span className="required-star">*</span></label>
                      <input
                        type="text"
                        className="form-control-input"
                        value={claimFormData.fullName}
                        onChange={(e) => setClaimFormData({ ...claimFormData, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-row">
                      <label className="form-label-bold">Email Address <span className="required-star">*</span></label>
                      <input
                        type="email"
                        className="form-control-input"
                        value={claimFormData.email}
                        onChange={(e) => setClaimFormData({ ...claimFormData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-row">
                      <label className="form-label-bold">Phone Number <span className="required-star">*</span></label>
                      <input
                        type="text"
                        className="form-control-input"
                        value={claimFormData.phone}
                        onChange={(e) => setClaimFormData({ ...claimFormData, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-row">
                      <label className="form-label-bold">Claimed Item Name</label>
                      <input
                        type="text"
                        className="form-control-input"
                        placeholder="e.g. Titan Watch, Black Backpack"
                        value={claimFormData.itemName}
                        onChange={(e) => setClaimFormData({ ...claimFormData, itemName: e.target.value })}
                      />
                    </div>
                    <div className="form-group-row">
                      <label className="form-label-bold">Additional Details</label>
                      <textarea
                        className="form-control-textarea"
                        placeholder="Proof of ownership details..."
                        value={claimFormData.additionalDetails}
                        onChange={(e) => setClaimFormData({ ...claimFormData, additionalDetails: e.target.value })}
                      ></textarea>
                    </div>
                    <div className="form-group-row">
                      <label className="form-label-bold">Proof Image</label>
                      <input
                        type="file"
                        className="form-file-input"
                        accept="image/*"
                        onChange={(e) => setClaimFormData({ ...claimFormData, imageFile: e.target.files[0] })}
                      />
                    </div>
                    <div className="form-buttons-row">
                      <button type="submit" className="btn-form-save">Save Claim</button>
                      <button type="button" className="btn-form-cancel" onClick={() => setClaimFormOpen(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <div className="crud-header-actions">
                    <button className="crud-btn-primary" onClick={() => setClaimFormOpen(true)}>
                      <FiPlus /> Add Claim Request
                    </button>
                    <div className="crud-tools-right">
                      <button
                        className="crud-tool-btn"
                        onClick={() =>
                          handleExportCSV(
                            claims.map((c) => ({
                              ID: c._id,
                              Name: c.fullName,
                              Email: c.email,
                              Phone: c.phone,
                              Item: c.itemName || c.item?.title || '—',
                              Status: c.status,
                              SubmittedAt: new Date(c.submittedAt).toLocaleString(),
                            })),
                            'claim_requests'
                          )
                        }
                      >
                        <FiDownload /> Export
                      </button>
                      <button className="crud-tool-btn" onClick={handlePrint}>
                        <FiPrinter /> Print
                      </button>
                    </div>
                  </div>

                  <div className="table-responsive-wrapper">
                    <table className="admin-crud-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>FULL NAME</th>
                          <th>EMAIL ADDRESS</th>
                          <th>PHONE NUMBER</th>
                          <th>IMAGE</th>
                          <th>ADDITIONAL DETAILS</th>
                          <th>STATUS</th>
                          <th>SUBMITTED AT</th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.length === 0 ? (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                              No claim requests found.
                            </td>
                          </tr>
                        ) : (
                          paginatedData.map((c) => (
                            <tr key={c._id}>
                              <td style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                                {String(c._id).slice(-6)}
                              </td>
                              <td style={{ fontWeight: 600 }}>{c.fullName}</td>
                              <td>{c.email}</td>
                              <td>{c.phone}</td>
                              <td>
                                {c.image ? (
                                  <>
                                    <img
                                      src={getImageUrl(c.image)}
                                      alt="Proof"
                                      style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px' }}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        if (e.currentTarget.nextElementSibling) {
                                          e.currentTarget.nextElementSibling.style.display = 'inline';
                                        }
                                      }}
                                    />
                                    <span style={{ color: '#aaa', fontSize: '11px', display: 'none' }}>None</span>
                                  </>
                                ) : (
                                  <span style={{ color: '#aaa', fontSize: '11px' }}>None</span>
                                )}
                              </td>
                              <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.additionalDetails || '—'}
                              </td>
                              <td>
                                <span className={`status-pill ${(c.status || 'pending').toLowerCase()}`}>
                                  {c.status || 'Pending'}
                                </span>
                              </td>
                              <td style={{ fontSize: '12px' }}>
                                {new Date(c.submittedAt || c.createdAt).toLocaleDateString()}
                              </td>
                              <td>
                                <div className="action-buttons-group">
                                  <button
                                    className="action-icon-btn action-icon-view"
                                    title="View Claim Details"
                                    onClick={() => handleOpenClaimDetails(c)}
                                  >
                                    <FiEye />
                                  </button>
                                  {c.status !== 'approved' && (
                                    <button
                                      className="action-icon-btn action-icon-approve"
                                      title="Approve Claim"
                                      onClick={() => handleUpdateClaimStatus(c._id, 'approved')}
                                    >
                                      <FiCheck />
                                    </button>
                                  )}
                                  {c.status !== 'rejected' && (
                                    <button
                                      className="action-icon-btn action-icon-reject"
                                      title="Reject Claim"
                                      onClick={() => handleUpdateClaimStatus(c._id, 'rejected')}
                                    >
                                      <FiX />
                                    </button>
                                  )}
                                  <button
                                    className="action-icon-btn action-icon-delete"
                                    title="Delete Claim"
                                    onClick={() => handleDeleteClaim(c._id)}
                                  >
                                    <FiTrash2 />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="crud-bottom-bar">
                    <div className="crud-search-block">
                      <span className="crud-search-label">Search:</span>
                      <input
                        type="text"
                        className="crud-search-input"
                        placeholder="Search claims..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <select
                        className="crud-search-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <button className="crud-btn-clear" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
                        Clear filtering
                      </button>
                    </div>

                    <div className="crud-pagination-block">
                      <span className="crud-page-info">
                        Showing {totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                        {Math.min(currentPage * pageSize, totalEntries)} of {totalEntries} entries
                      </span>
                      <div className="crud-pagination-nav">
                        <button className="crud-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>First</button>
                        <button className="crud-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>Previous</button>
                        <button className="crud-page-btn active">{currentPage}</button>
                        <button className="crud-page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Next</button>
                        <button className="crud-page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>Last</button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ========================================================
              VIEW 4: CATEGORIES MANAGEMENT
             ======================================================== */}
          {currentTab === 'categories' && (
            <div className="crud-page-container">
              <div className="crud-header-actions">
                <button className="crud-btn-primary" onClick={handleOpenAddCategory}>
                  <FiPlus /> Add Category
                </button>
                <div className="crud-tools-right">
                  <button
                    className="crud-tool-btn"
                    onClick={() =>
                      handleExportCSV(
                        categories.map((c) => ({
                          CategoryName: c.name,
                          Description: c.description,
                          CreatedAt: new Date(c.createdAt).toLocaleDateString(),
                        })),
                        'categories'
                      )
                    }
                  >
                    <FiDownload /> Export
                  </button>
                  <button className="crud-tool-btn" onClick={handlePrint}>
                    <FiPrinter /> Print
                  </button>
                </div>
              </div>

              <div className="table-responsive-wrapper">
                <table className="admin-crud-table">
                  <thead>
                    <tr>
                      <th>CATEGORY NAME</th>
                      <th>DESCRIPTION</th>
                      <th>ITEMS USING THIS</th>
                      <th>CREATED AT</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                          No categories defined in MongoDB.
                        </td>
                      </tr>
                    ) : (
                      categories.map((c) => (
                        <tr key={c._id}>
                          <td style={{ fontWeight: 600, color: '#1e2a38' }}>
                            <FiTag style={{ marginRight: '6px', color: '#3498db' }} />
                            {c.name}
                          </td>
                          <td>{c.description || '—'}</td>
                          <td>
                            <span className="badge-pill" style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                              Dynamic
                            </span>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'System default'}
                          </td>
                          <td>
                            <div className="action-buttons-group">
                              <button
                                className="action-icon-btn action-icon-edit"
                                title="Edit Category"
                                onClick={() => handleOpenEditCategory(c)}
                              >
                                <FiEdit />
                              </button>
                              <button
                                className="action-icon-btn action-icon-delete"
                                title="Delete Category"
                                onClick={() => handleDeleteCategory(c._id)}
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 5: ADMINS MANAGEMENT
             ======================================================== */}
          {currentTab === 'admins' && (
            <div className="crud-page-container">
              <div className="crud-header-actions">
                <button className="crud-btn-primary" onClick={handleOpenAddAdmin}>
                  <FiPlus /> Add Admin
                </button>
                <div className="crud-tools-right">
                  <button
                    className="crud-tool-btn"
                    onClick={() =>
                      handleExportCSV(
                        admins.map((a) => ({
                          Name: a.name,
                          Email: a.email,
                          Role: a.role,
                          Status: a.status,
                          CreatedAt: new Date(a.createdAt).toLocaleDateString(),
                        })),
                        'admins_list'
                      )
                    }
                  >
                    <FiDownload /> Export
                  </button>
                  <button className="crud-tool-btn" onClick={handlePrint}>
                    <FiPrinter /> Print
                  </button>
                </div>
              </div>

              <div className="table-responsive-wrapper">
                <table className="admin-crud-table">
                  <thead>
                    <tr>
                      <th>USERNAME</th>
                      <th>EMAIL</th>
                      <th>ROLE</th>
                      <th>STATUS</th>
                      <th>CREATED AT</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => {
                      const isPrimary = admin.email.toLowerCase() === 'admin@apsit.edu.in';
                      return (
                        <tr key={admin._id}>
                          <td style={{ fontWeight: 600 }}>{admin.name}</td>
                          <td>
                            {admin.email}{' '}
                            {isPrimary && (
                              <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 'bold' }}>
                                Dedicated Primary
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="status-pill active">{admin.role}</span>
                          </td>
                          <td>
                            <span className="status-pill approved">{admin.status || 'approved'}</span>
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {new Date(admin.createdAt).toLocaleDateString()}
                          </td>
                          <td>
                            <div className="action-buttons-group">
                              <button
                                className="action-icon-btn action-icon-view"
                                title="View Details"
                                onClick={() => setViewDetailsItem(admin)}
                              >
                                <FiEye />
                              </button>
                              <button
                                className="action-icon-btn action-icon-edit"
                                title="Edit Admin"
                                onClick={() => handleOpenEditAdmin(admin)}
                              >
                                <FiEdit />
                              </button>
                              {!isPrimary && (
                                <button
                                  className="action-icon-btn action-icon-delete"
                                  title="Delete Admin"
                                  onClick={() => handleDeleteAdmin(admin._id, admin.email)}
                                >
                                  <FiTrash2 />
                                </button>
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
          )}

          {/* ========================================================
              VIEW 6: USERS (STUDENTS APPROVAL SYSTEM)
             ======================================================== */}
          {currentTab === 'users' && (
            <div className="crud-page-container">
              <div className="crud-header-actions">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`crud-tool-btn ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All Students ({users.filter((u) => u.role !== 'admin').length})
                  </button>
                  <button
                    className={`crud-tool-btn ${statusFilter === 'pending' ? 'active' : ''}`}
                    style={statusFilter === 'pending' ? { background: '#f39c12', color: '#fff' } : {}}
                    onClick={() => setStatusFilter('pending')}
                  >
                    Pending ({users.filter((u) => u.role !== 'admin' && u.status === 'pending').length})
                  </button>
                  <button
                    className={`crud-tool-btn ${statusFilter === 'approved' ? 'active' : ''}`}
                    style={statusFilter === 'approved' ? { background: '#2ecc71', color: '#fff' } : {}}
                    onClick={() => setStatusFilter('approved')}
                  >
                    Approved ({users.filter((u) => u.role !== 'admin' && u.status === 'approved').length})
                  </button>
                  <button
                    className={`crud-tool-btn ${statusFilter === 'rejected' ? 'active' : ''}`}
                    style={statusFilter === 'rejected' ? { background: '#e74c3c', color: '#fff' } : {}}
                    onClick={() => setStatusFilter('rejected')}
                  >
                    Rejected ({users.filter((u) => u.role !== 'admin' && u.status === 'rejected').length})
                  </button>
                </div>

                <div className="crud-tools-right">
                  <button
                    className="crud-tool-btn"
                    onClick={() =>
                      handleExportCSV(
                        users.map((u) => ({
                          StudentID: u.studentId || u.email?.split('@')[0],
                          FullName: u.name,
                          Email: u.email,
                          Role: u.role,
                          Status: u.status,
                          CreatedAt: new Date(u.createdAt).toLocaleDateString(),
                        })),
                        'students_list'
                      )
                    }
                  >
                    <FiDownload /> Export
                  </button>
                  <button className="crud-tool-btn" onClick={handlePrint}>
                    <FiPrinter /> Print
                  </button>
                </div>
              </div>

              <div className="table-responsive-wrapper">
                <table className="admin-crud-table">
                  <thead>
                    <tr>
                      <th>STUDENT ID</th>
                      <th>FULL NAME</th>
                      <th>EMAIL</th>
                      <th>ROLE</th>
                      <th>STATUS</th>
                      <th>CREATED AT</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                          No students matching selected status.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((u) => {
                        const studentId = u.studentId || (u.email ? u.email.split('@')[0] : '—');
                        return (
                          <tr key={u._id}>
                            <td>
                              <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#0369a1', fontWeight: 'bold' }}>
                                {studentId}
                              </code>
                            </td>
                            <td style={{ fontWeight: 600 }}>{u.name}</td>
                            <td>{u.email}</td>
                            <td><span className="status-pill active">{u.role}</span></td>
                            <td>
                              <span className={`status-pill ${(u.status || 'pending').toLowerCase()}`}>
                                {u.status || 'pending'}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px' }}>
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td>
                              <div className="action-buttons-group">
                                {u.status === 'pending' && (
                                  <>
                                    <button
                                      className="action-icon-btn action-icon-approve"
                                      title="Approve Student Account"
                                      onClick={() => handleApproveStudent(u._id)}
                                    >
                                      <FiCheck />
                                    </button>
                                    <button
                                      className="action-icon-btn action-icon-reject"
                                      title="Reject Student Account"
                                      onClick={() => handleRejectStudent(u._id)}
                                    >
                                      <FiX />
                                    </button>
                                  </>
                                )}
                                {u.status === 'approved' && (
                                  <button
                                    className="action-icon-btn action-icon-reject"
                                    title="Revoke / Reject Account"
                                    onClick={() => handleRejectStudent(u._id)}
                                  >
                                    <FiX />
                                  </button>
                                )}
                                {u.status === 'rejected' && (
                                  <button
                                    className="action-icon-btn action-icon-approve"
                                    title="Approve / Re-activate Account"
                                    onClick={() => handleApproveStudent(u._id)}
                                  >
                                    <FiCheck />
                                  </button>
                                )}
                                <button
                                  className="action-icon-btn action-icon-delete"
                                  title="Delete Account"
                                  onClick={() => handleDeleteUserAccount(u._id)}
                                >
                                  <FiTrash2 />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="crud-bottom-bar">
                <div className="crud-search-block">
                  <span className="crud-search-label">Search:</span>
                  <input
                    type="text"
                    className="crud-search-input"
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="crud-btn-clear" onClick={() => setSearchTerm('')}>
                    Clear
                  </button>
                </div>

                <div className="crud-pagination-block">
                  <span className="crud-page-info">
                    Showing {totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, totalEntries)} of {totalEntries} entries
                  </span>
                  <div className="crud-pagination-nav">
                    <button className="crud-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>First</button>
                    <button className="crud-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>Previous</button>
                    <button className="crud-page-btn active">{currentPage}</button>
                    <button className="crud-page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Next</button>
                    <button className="crud-page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>Last</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 7: REPORTS
             ======================================================== */}
          {currentTab === 'reports' && (
            <div className="crud-page-container">
              <div className="crud-header-actions">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <label style={{ fontWeight: 600, fontSize: '14px', color: '#1e2a38' }}>Select Report:</label>
                  <select
                    className="form-control-select"
                    style={{ width: 'auto', minWidth: '220px' }}
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <option value="lost">Lost Items Report</option>
                    <option value="found">Found Items Report</option>
                    <option value="resolved">Resolved / Claimed Items Report</option>
                    <option value="claims">Claim Requests Report</option>
                    <option value="users">User Registration Report</option>
                    <option value="status">Status Distribution Report</option>
                    <option value="category">Category Breakdown Report</option>
                  </select>
                </div>

                <div className="crud-tools-right">
                  <button
                    className="crud-tool-btn"
                    onClick={() => {
                      let exportRows = [];
                      if (reportType === 'lost') {
                        exportRows = items.filter((i) => i.type === 'lost');
                      } else if (reportType === 'found') {
                        exportRows = items.filter((i) => i.type === 'found');
                      } else if (reportType === 'resolved') {
                        exportRows = items.filter((i) => (i.status || '').toLowerCase() === 'resolved' || (i.status || '').toLowerCase() === 'claimed').map((i) => ({
                          ItemName: i.title,
                          Owner: i.reportedBy?.name || '—',
                          Finder: i.foundBy?.name || i.claimedBy?.name || '—',
                          ClaimStatus: i.status,
                          ClaimDate: i.claims?.[0]?.createdAt ? new Date(i.claims[0].createdAt).toLocaleDateString() : '—',
                          ResolutionDate: i.resolvedAt ? new Date(i.resolvedAt).toLocaleDateString() : '—',
                        }));
                      } else if (reportType === 'claims') {
                        exportRows = claims;
                      } else if (reportType === 'users') {
                        exportRows = users;
                      }
                      handleExportCSV(exportRows, `report_${reportType}`);
                    }}
                  >
                    <FiDownload /> Export CSV
                  </button>
                  <button className="crud-tool-btn" onClick={handlePrint}>
                    <FiPrinter /> Print Report
                  </button>
                </div>
              </div>

              {/* Report Renderings */}
              <div className="table-responsive-wrapper" style={{ marginTop: '16px' }}>
                <table className="admin-crud-table">
                  {reportType === 'lost' && (
                    <>
                      <thead>
                        <tr>
                          <th>ITEM NAME</th>
                          <th>CATEGORY</th>
                          <th>LOCATION</th>
                          <th>DATE LOST</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.filter((i) => i.type === 'lost').map((item) => (
                          <tr key={item._id}>
                            <td style={{ fontWeight: 600 }}>{item.title}</td>
                            <td>{item.category}</td>
                            <td>{item.location}</td>
                            <td>{item.date ? new Date(item.date).toLocaleDateString() : '—'}</td>
                            <td><span className={`status-pill ${(item.status || 'pending').toLowerCase()}`}>{item.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {reportType === 'found' && (
                    <>
                      <thead>
                        <tr>
                          <th>ITEM NAME</th>
                          <th>LOCATION FOUND</th>
                          <th>DATE FOUND</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.filter((i) => i.type === 'found').map((item) => (
                          <tr key={item._id}>
                            <td style={{ fontWeight: 600 }}>{item.title}</td>
                            <td>{item.location}</td>
                            <td>{item.date ? new Date(item.date).toLocaleDateString() : '—'}</td>
                            <td><span className={`status-pill ${(item.status || 'pending').toLowerCase()}`}>{item.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {reportType === 'resolved' && (
                    <>
                      <thead>
                        <tr>
                          <th>ITEM NAME</th>
                          <th>REPORTED BY / OWNER</th>
                          <th>FOUND BY / FINDER</th>
                          <th>CLAIM STATUS</th>
                          <th>CLAIM DATE</th>
                          <th>RESOLUTION DATE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.filter((i) => (i.status || '').toLowerCase() === 'resolved' || (i.status || '').toLowerCase() === 'claimed').map((item) => (
                          <tr key={item._id}>
                            <td style={{ fontWeight: 600 }}>{item.title}</td>
                            <td>{item.reportedBy?.name || '—'}</td>
                            <td>{item.foundBy?.name || item.claimedBy?.name || (item.claims?.[0]?.finder?.name || item.claims?.[0]?.fullName) || '—'}</td>
                            <td>
                              <span className={`status-pill ${(item.status || 'resolved').toLowerCase()}`}>
                                {item.status || 'Resolved'}
                              </span>
                            </td>
                            <td>{item.claims?.[0]?.createdAt ? new Date(item.claims[0].createdAt).toLocaleDateString() : '—'}</td>
                            <td>{item.resolvedAt ? new Date(item.resolvedAt).toLocaleDateString() : new Date(item.updatedAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {reportType === 'claims' && (
                    <>
                      <thead>
                        <tr>
                          <th>CLAIMANT</th>
                          <th>EMAIL</th>
                          <th>ITEM</th>
                          <th>STATUS</th>
                          <th>SUBMITTED AT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claims.map((c) => (
                          <tr key={c._id}>
                            <td style={{ fontWeight: 600 }}>{c.fullName}</td>
                            <td>{c.email}</td>
                            <td>{c.itemName || '—'}</td>
                            <td><span className={`status-pill ${(c.status || 'pending').toLowerCase()}`}>{c.status}</span></td>
                            <td>{new Date(c.submittedAt || c.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {reportType === 'users' && (
                    <>
                      <thead>
                        <tr>
                          <th>STUDENT NAME</th>
                          <th>COLLEGE EMAIL</th>
                          <th>APPROVAL STATUS</th>
                          <th>JOINED DATE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u._id}>
                            <td style={{ fontWeight: 600 }}>{u.name}</td>
                            <td>{u.email}</td>
                            <td><span className={`status-pill ${(u.status || 'pending').toLowerCase()}`}>{u.status}</span></td>
                            <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {reportType === 'status' && (
                    <>
                      <thead>
                        <tr>
                          <th>STATUS</th>
                          <th>TOTAL ITEMS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(analytics?.status_data || {}).map(([st, cnt]) => (
                          <tr key={st}>
                            <td style={{ fontWeight: 600 }}>{st}</td>
                            <td><strong>{cnt}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {reportType === 'category' && (
                    <>
                      <thead>
                        <tr>
                          <th>CATEGORY NAME</th>
                          <th>TOTAL REPORTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analytics?.category_data || []).map((cat) => (
                          <tr key={cat.category_name}>
                            <td style={{ fontWeight: 600 }}>{cat.category_name}</td>
                            <td><strong>{cat.item_count}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Claim Details Modal (Requirement 12) */}
      {claimModalOpen && selectedClaim && (
        <div className="modal-overlay" onClick={() => setClaimModalOpen(false)}>
          <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h4>Claim Request Details</h4>
              <button className="modal-close-btn" onClick={() => setClaimModalOpen(false)}>✕</button>
            </div>

            <div className="detail-row">
              <span className="detail-label">Claim ID:</span>
              <span className="detail-value">{selectedClaim._id}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Lost Item ID / Name:</span>
              <span className="detail-value">{selectedClaim.item?._id || 'N/A'} ({selectedClaim.itemName || selectedClaim.item?.title || '—'})</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Reported By / Owner:</span>
              <span className="detail-value">
                {selectedClaim.owner?.name
                  ? `${selectedClaim.owner.name} (${selectedClaim.owner.email || ''}${selectedClaim.owner.phone ? ' | ' + selectedClaim.owner.phone : ''})`
                  : (selectedClaim.item?.reportedBy?.name
                    ? `${selectedClaim.item.reportedBy.name} (${selectedClaim.item.reportedBy.email || ''}${selectedClaim.item.reportedBy.phone ? ' | ' + selectedClaim.item.reportedBy.phone : ''})`
                    : '—')}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Found By / Finder:</span>
              <span className="detail-value" style={{ fontWeight: 600 }}>
                {selectedClaim.finder?.name || selectedClaim.fullName || '—'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Finder Contact Info:</span>
              <span className="detail-value">
                {selectedClaim.finder?.email || selectedClaim.email} | {selectedClaim.finder?.phone || selectedClaim.phone}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Finder Message:</span>
              <span className="detail-value">{selectedClaim.finderMessage || selectedClaim.additionalDetails || 'None provided'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Claim Status:</span>
              <span className="detail-value">
                <span className={`status-pill ${(selectedClaim.status || 'pending').toLowerCase()}`}>
                  {selectedClaim.status}
                </span>
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Claim Date:</span>
              <span className="detail-value">{new Date(selectedClaim.submittedAt || selectedClaim.createdAt).toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Resolution Date:</span>
              <span className="detail-value">
                {selectedClaim.resolvedAt
                  ? new Date(selectedClaim.resolvedAt).toLocaleString()
                  : (selectedClaim.item?.resolvedAt
                    ? new Date(selectedClaim.item.resolvedAt).toLocaleString()
                    : 'Not resolved yet')}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Resolution History:</span>
              <span className="detail-value">
                {selectedClaim.status === 'resolved' || selectedClaim.status === 'approved' || selectedClaim.item?.status === 'Resolved'
                  ? `Claim was marked as ${selectedClaim.status} on ${new Date(selectedClaim.resolvedAt || selectedClaim.updatedAt).toLocaleString()}`
                  : `Claim currently has status "${selectedClaim.status}" (Initial contact recorded)`}
              </span>
            </div>

            {selectedClaim.image && (
              <div style={{ marginTop: '16px' }}>
                <span className="detail-label" style={{ display: 'block', marginBottom: '8px' }}>Proof Image:</span>
                <img
                  src={getImageUrl(selectedClaim.image)}
                  alt="Proof"
                  style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain', border: '1px solid #ddd' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'block';
                    }
                  }}
                />
                <span style={{ color: '#888', fontSize: '12px', display: 'none' }}>Proof image unavailable</span>
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', gap: '10px', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '16px' }}>
              <button className="crud-tool-btn" onClick={() => setClaimModalOpen(false)}>
                <FiArrowLeft /> Back to list
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedClaim.status !== 'approved' && (
                  <button className="btn-form-save" onClick={() => handleUpdateClaimStatus(selectedClaim._id, 'approved')}>
                    Approve Claim
                  </button>
                )}
                {selectedClaim.status !== 'rejected' && (
                  <button className="admin-logout-btn" onClick={() => handleUpdateClaimStatus(selectedClaim._id, 'rejected')}>
                    Reject Claim
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal (Add/Edit) */}
      {categoryModalOpen && (
        <div className="modal-overlay" onClick={() => setCategoryModalOpen(false)}>
          <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h4>{editingCategory ? 'Edit Category' : 'Add New Category'}</h4>
              <button className="modal-close-btn" onClick={() => setCategoryModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveCategory}>
              <div className="form-group-row">
                <label className="form-label-bold">Category Name <span className="required-star">*</span></label>
                <input
                  type="text"
                  className="form-control-input"
                  placeholder="e.g. ID & Cards, Umbrellas"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-row">
                <label className="form-label-bold">Description</label>
                <input
                  type="text"
                  className="form-control-input"
                  placeholder="Short description..."
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                />
              </div>
              <div className="form-buttons-row">
                <button type="submit" className="btn-form-save">Save Category</button>
                <button type="button" className="btn-form-cancel" onClick={() => setCategoryModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin User Modal (Add/Edit) */}
      {adminModalOpen && (
        <div className="modal-overlay" onClick={() => setAdminModalOpen(false)}>
          <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h4>{editingAdmin ? 'Edit Admin User' : 'Add Admin User'}</h4>
              <button className="modal-close-btn" onClick={() => setAdminModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveAdmin}>
              <div className="form-group-row">
                <label className="form-label-bold">Full Name <span className="required-star">*</span></label>
                <input
                  type="text"
                  className="form-control-input"
                  value={adminFormData.name}
                  onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-row">
                <label className="form-label-bold">Email <span className="required-star">*</span></label>
                <input
                  type="email"
                  className="form-control-input"
                  value={adminFormData.email}
                  disabled={editingAdmin?.email === 'admin@apsit.edu.in'}
                  onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-row">
                <label className="form-label-bold">
                  Password {editingAdmin ? '(Leave blank to keep unchanged)' : <span className="required-star">*</span>}
                </label>
                <input
                  type="password"
                  className="form-control-input"
                  placeholder="Min 6 characters"
                  value={adminFormData.password}
                  onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                  required={!editingAdmin}
                />
              </div>
              <div className="form-buttons-row">
                <button type="submit" className="btn-form-save">Save Admin</button>
                <button type="button" className="btn-form-cancel" onClick={() => setAdminModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Item Details Modal */}
      {viewDetailsItem && (
        <div className="modal-overlay" onClick={() => setViewDetailsItem(null)}>
          <div className="modal-content-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h4>Item Details</h4>
              <button className="modal-close-btn" onClick={() => setViewDetailsItem(null)}>✕</button>
            </div>
            <div className="detail-row">
              <span className="detail-label">Title / Name:</span>
              <span className="detail-value" style={{ fontWeight: 600 }}>{viewDetailsItem.title || viewDetailsItem.name}</span>
            </div>
            {viewDetailsItem.category && (
              <div className="detail-row">
                <span className="detail-label">Category:</span>
                <span className="detail-value">{viewDetailsItem.category}</span>
              </div>
            )}
            {viewDetailsItem.description && (
              <div className="detail-row">
                <span className="detail-label">Description:</span>
                <span className="detail-value">{viewDetailsItem.description}</span>
              </div>
            )}
            {viewDetailsItem.location && (
              <div className="detail-row">
                <span className="detail-label">Location:</span>
                <span className="detail-value">{viewDetailsItem.location}</span>
              </div>
            )}
            {viewDetailsItem.status && (
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className="detail-value">
                  <span className={`status-pill ${(viewDetailsItem.status || '').toLowerCase()}`}>
                    {viewDetailsItem.status}
                  </span>
                </span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Reported By / Owner:</span>
              <span className="detail-value">
                {viewDetailsItem.reportedBy?.name
                  ? `${viewDetailsItem.reportedBy.name} (${viewDetailsItem.reportedBy.email || ''}${viewDetailsItem.reportedBy.phone ? ' | ' + viewDetailsItem.reportedBy.phone : ''})`
                  : '—'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Found By / Finder:</span>
              <span className="detail-value">
                {viewDetailsItem.foundBy?.name
                  ? `${viewDetailsItem.foundBy.name} (${viewDetailsItem.foundBy.email || ''}${viewDetailsItem.foundBy.phone ? ' | ' + viewDetailsItem.foundBy.phone : ''})`
                  : (viewDetailsItem.claims?.[0]?.finder?.name
                    ? `${viewDetailsItem.claims[0].finder.name} (${viewDetailsItem.claims[0].finder.email || ''})`
                    : (viewDetailsItem.claims?.[0]?.fullName
                      ? `${viewDetailsItem.claims[0].fullName} (${viewDetailsItem.claims[0].email || ''})`
                      : '—'))}
              </span>
            </div>
            {(viewDetailsItem.foundBy?.email || viewDetailsItem.claims?.[0]?.email || viewDetailsItem.claims?.[0]?.phone) && (
              <div className="detail-row">
                <span className="detail-label">Finder Contact:</span>
                <span className="detail-value">
                  {viewDetailsItem.claims?.[0]?.email || viewDetailsItem.foundBy?.email || '—'}
                  {(viewDetailsItem.claims?.[0]?.phone || viewDetailsItem.foundBy?.phone) ? ` | ${viewDetailsItem.claims?.[0]?.phone || viewDetailsItem.foundBy?.phone}` : ''}
                </span>
              </div>
            )}
            {(viewDetailsItem.claims?.[0]?.finderMessage || viewDetailsItem.claims?.[0]?.additionalDetails) && (
              <div className="detail-row">
                <span className="detail-label">Finder Message:</span>
                <span className="detail-value">
                  {viewDetailsItem.claims[0].finderMessage || viewDetailsItem.claims[0].additionalDetails}
                </span>
              </div>
            )}
            {viewDetailsItem.claims && viewDetailsItem.claims.length > 0 && (
              <div className="detail-row">
                <span className="detail-label">Claim Status:</span>
                <span className="detail-value">
                  <span className={`status-pill ${(viewDetailsItem.claims[0].status || 'pending').toLowerCase()}`}>
                    {viewDetailsItem.claims[0].status}
                  </span>
                </span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Resolution Date:</span>
              <span className="detail-value">
                {viewDetailsItem.resolvedAt
                  ? new Date(viewDetailsItem.resolvedAt).toLocaleString()
                  : ((viewDetailsItem.status || '').toLowerCase() === 'resolved'
                    ? new Date(viewDetailsItem.updatedAt).toLocaleString()
                    : 'Not resolved')}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Resolution History:</span>
              <span className="detail-value">
                {(viewDetailsItem.status || '').toLowerCase() === 'resolved'
                  ? `Item officially recovered and marked Resolved on ${new Date(viewDetailsItem.resolvedAt || viewDetailsItem.updatedAt).toLocaleString()}`
                  : `Item status is ${viewDetailsItem.status || 'Active'}`}
              </span>
            </div>
            {viewDetailsItem.image && (
              <div style={{ marginTop: '12px' }}>
                <span className="detail-label" style={{ display: 'block', marginBottom: '6px' }}>Image:</span>
                <img
                  src={getImageUrl(viewDetailsItem.image)}
                  alt={viewDetailsItem.title}
                  style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '6px', objectFit: 'contain' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'block';
                    }
                  }}
                />
                <span style={{ color: '#888', fontSize: '12px', display: 'none' }}>Image unavailable</span>
              </div>
            )}
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button className="btn-form-cancel" onClick={() => setViewDetailsItem(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
