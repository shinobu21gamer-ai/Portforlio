import Swal from 'sweetalert2';

export const confirmDelete = (message = 'Are you sure you want to delete this?') => {
  return Swal.fire({
    title: 'Confirm Delete',
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel',
  }).then(result => result.isConfirmed);
};

export const confirmAction = (message, title = 'Confirm') => {
  return Swal.fire({
    title,
    text: message,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes',
    cancelButtonText: 'Cancel',
  }).then(result => result.isConfirmed);
};

export const confirmApprove = (message = 'Approve this item?') => {
  return Swal.fire({
    title: 'Approve',
    text: message,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#22c55e',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, approve',
    cancelButtonText: 'Cancel',
  }).then(result => result.isConfirmed);
};

export const confirmReject = (message = 'Reject this item?') => {
  return Swal.fire({
    title: 'Reject',
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, reject',
    cancelButtonText: 'Cancel',
  }).then(result => result.isConfirmed);
};

export const confirmTerminate = (message = 'Terminate this?') => {
  return Swal.fire({
    title: 'Terminate',
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Yes, terminate',
    cancelButtonText: 'Cancel',
  }).then(result => result.isConfirmed);
};

export default Swal;
