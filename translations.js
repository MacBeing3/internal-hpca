var T = {
  fr: {
    appTitle:'Inventaire des Médicaments',
    appSub:'Gestion des stocks — Pharmacie',
    tabInv:'Inventaire',
    tabDisp:'Dispensation',

    // Stats
    slTotal:'Total produits',
    slLow:'Stock faible',
    slCritical:'Stock critique',

    // Filters
    fAll:'Tous les stocks',
    fOk:'Stock OK',
    fLow:'Stock faible',
    fCritical:'Stock critique',
    fFamAll:'Toutes familles',
    fCatAll:'Toutes catégories',

    // Table headers
    hCode:'Code', hProduct:'Produit', hDose:'Dose', hFormat:'Fmt', hDateExp:'Exp.',
    hStockInit:'Init.', hPa:'PA', hPrixUnit:'Prix/u', hSorties:'Sort.', hChange:'Chg',
    hStockActuel:'Stock act.', hObs:'Statut', hConsEstMo:'Cons/mo', hMoRest:'Mo rest.',
    hQuantMin:'Q.min', hValeur:'Valeur', hEtatsUnis:'EU', hEssentiel:'Essent.', hFamille:'Famille',

    // Meta
    metaProducts:'produits',
    metaUpdated:"Mis à jour : aujourd'hui",

    // Stock status badges
    statusOk:'Adéquat',
    statusLow:'Faible',
    statusCritical:'Critique',

    // Inventory UI
    searchPlaceholder:'Rechercher...',
    statePrompt:'Cliquez sur "Charger l\'inventaire" pour commencer.',
    errEmpty:'Le fichier est vide ou ne contient pas de données valides.',
    noResults:'Aucun résultat',
    updInv:"Charger l'inventaire",

    // Dispensation page
    dispTitle:'Dispensation des médicaments',
    dispSectionPatient:'Informations patient',
    dispSectionMeds:'Médicaments dispensés',
    dispSectionTotal:'Total',

    // Dispensation form labels
    lblDossier:'N° Dossier',
    lblDate:'Date',
    lblTime:'Heure',
    lblMed:'Médicament',
    lblQty:'Quantité',
    lblForfait:'Forfaitaire',
    lblUnitPrice:'Prix/u :',
    lblGrandTotal:'Total',
    lblNoPrice:'—',

    // Dispensation buttons
    btnAddMed:'+ Ajouter un médicament',
    btnSubmit:'Soumettre',
    btnRemove:'×',
    selectMed:'-- Choisir un médicament --',

    // Dispensation notices & toasts
    noInvMsg:"L'inventaire n'est pas encore chargé. Les médicaments ne seront pas disponibles.",
    // Historique tab
    tabHist:'Historique',
    btnLoadHist:"Charger l'historique",
    histStatePrompt:'Cliquez sur "Charger l\'historique" pour commencer.',
    histErrEmpty:'Aucune donnée trouvée dans la feuille Dispensation.',
    lblHistFrom:'Du :',
    lblHistTo:'Au :',
    btnHistClear:'✕ Réinitialiser',
    hhDossier:'Dossier', hhDate:'Date', hhTime:'Heure', hhProduct:'Produit',
    hhDose:'Dose', hhFormat:'Format', hhUnitPrice:'Prix/u', hhQty:'Qté',
    hhTotal:'Total', hhForfait:'Forfaitaire',
    histSearchPlaceholder:'Filtrer par dossier...',
    modalTitle:'Confirmer la suppression',
    modalBody:'Vous êtes sur le point de supprimer cette ligne :',
    modalCancel:'Annuler',
    modalConfirm:'Supprimer',
    toastDeleted:'Ligne supprimée avec succès.',
    toastDeleteError:'Erreur lors de la suppression. Veuillez réessayer.',
    toastSuccess:'Dispensation enregistrée avec succès.',
    toastError:"Erreur lors de l'envoi. Veuillez réessayer.",
    toastValidate:'Veuillez remplir tous les champs obligatoires.',
    toastNoMeds:'Veuillez ajouter au moins un médicament.',

    lblMedProduct: 'Produit',
    lblMedDose:    'Dose',
    lblMedFormat:  'Format',
    selectMedProduct: '-- Produit --',
    selectMedDose:    '-- Dose --',
    selectMedFormat:  '-- Format --'
  },

  en: {
    appTitle:'Medication Inventory',
    appSub:'Stock Management — Pharmacy',
    tabInv:'Inventory',
    tabDisp:'Dispensation',

    // Stats
    slTotal:'Total products',
    slLow:'Low stock',
    slCritical:'Critical stock',

    // Filters
    fAll:'All stock levels',
    fOk:'Stock OK',
    fLow:'Low stock',
    fCritical:'Critical stock',
    fFamAll:'All families',
    fCatAll:'All categories',

    // Table headers
    hCode:'Code', hProduct:'Product', hDose:'Dose', hFormat:'Fmt', hDateExp:'Exp.',
    hStockInit:'Init.', hPa:'PA', hPrixUnit:'Price/u', hSorties:'Out.', hChange:'Chg',
    hStockActuel:'Curr. stock', hObs:'Status', hConsEstMo:'Cons/mo', hMoRest:'Mo rem.',
    hQuantMin:'Q.min', hValeur:'Value', hEtatsUnis:'US', hEssentiel:'Essent.', hFamille:'Family',

    // Meta
    metaProducts:'products',
    metaUpdated:'Updated: today',

    // Stock status badges
    statusOk:'Adequate',
    statusLow:'Low',
    statusCritical:'Critical',

    // Inventory UI
    searchPlaceholder:'Search...',
    statePrompt:'Click "Load Inventory" to begin.',
    errEmpty:'The file is empty or contains no valid data.',
    noResults:'No results found',
    updInv:'Load Inventory',

    // Dispensation page
    dispTitle:'Medication Dispensation',
    dispSectionPatient:'Patient Information',
    dispSectionMeds:'Dispensed Medications',
    dispSectionTotal:'Total',

    // Dispensation form labels
    lblDossier:'File No.',
    lblDate:'Date',
    lblTime:'Time',
    lblMed:'Medication',
    lblQty:'Quantity',
    lblForfait:'Forfaitaire',
    lblUnitPrice:'Price/u:',
    lblGrandTotal:'Total',
    lblNoPrice:'—',

    // Dispensation buttons
    btnAddMed:'+ Add medication',
    btnSubmit:'Submit',
    btnRemove:'×',
    selectMed:'-- Select a medication --',

    // Dispensation notices & toasts
    noInvMsg:'Inventory not yet loaded. Medications will not be available in the dropdown.',
    // Historique tab
    tabHist:'History',
    btnLoadHist:'Load history',
    histStatePrompt:'Click "Load history" to begin.',
    histErrEmpty:'No data found in the Dispensation sheet.',
    lblHistFrom:'From:',
    lblHistTo:'To:',
    btnHistClear:'✕ Reset',
    hhDossier:'File No.', hhDate:'Date', hhTime:'Time', hhProduct:'Product',
    hhDose:'Dose', hhFormat:'Format', hhUnitPrice:'Price/u', hhQty:'Qty',
    hhTotal:'Total', hhForfait:'Forfaitaire',
    histSearchPlaceholder:'Filter by file no...',
    modalTitle:'Confirm deletion',
    modalBody:'You are about to delete this row:',
    modalCancel:'Cancel',
    modalConfirm:'Delete',
    toastDeleted:'Row deleted successfully.',
    toastDeleteError:'Error deleting row. Please try again.',
    toastSuccess:'Dispensation recorded successfully.',
    toastError:'Error sending data. Please try again.',
    toastValidate:'Please fill in all required fields.',
    toastNoMeds:'Please add at least one medication.',

    lblMedProduct: 'Product',
    lblMedDose:    'Dose',
    lblMedFormat:  'Format',
    selectMedProduct: '-- Product --',
    selectMedDose:    '-- Dose --',
    selectMedFormat:  '-- Format --'
  }
};
