// public/js/nptifications.js

export function showNotification({message, type = 'success'}) {
	const base = 'fixed top-5 right-5 flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg z-50 text-white text-base font-semibold transition-all duration-300 ease-in-out';
	const iconMap = {
		success: {
			color: 'bg-green-500',
			icon: `<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
						</svg>`
		},
		error: {
			color: 'bg-red-500',
			icon: `<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
						</svg>`
		},
		warning: {
			color: 'bg-amber-500',
			icon: `<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M12 5a7 7 0 100 14 7 7 0 000-14z"/>
						</svg>`
		},
		info: {
			color: 'bg-blue-500',
			icon: `<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 4a8 8 0 100 16 8 8 0 000-16z"/>
						</svg>`
		},
		default: {
			color: 'bg-gray-500',
			icon: `<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
						</svg>`
		}
	};

	const { color, icon } = iconMap[type] || iconMap.default;
	notification.className = `${base} ${color}`;
	notification.innerHTML = `${icon}<span>${message}</span>`;

	notification.classList.toggle('animate-shake', type === 'error');
	notification.classList.remove('hidden');

	setTimeout(() => notification.classList.add('hidden'), 3000);
}

export async function openEditFileModal(fileId, currentName, currentVisible) {
	const { value: formValues } = await Swal.fire({
		title: 'Editar archivo',
		html: `
		<label for="swal-filename" class="swal2-input-label">Nuevo nombre del archivo</label>
		<input id="swal-filename" type="text" class="swal2-input w-full" style="margin: 1em 0 3px" placeholder="Ej: Aviso de Embarque V2" value="${currentName}" />

		<label for="swal-visible" class="swal2-input-label"">¿Visible para el cliente?</label>
		<select id="swal-visible" class="swal2-input w-full mt-4">
			<option value="1" ${currentVisible ? 'selected' : ''}>Sí</option>
			<option value="0" ${!currentVisible ? 'selected' : ''}>No</option>
		</select>
	`,
		focusConfirm: false,
		showCancelButton: true,
		confirmButtonText: 'Guardar',
		cancelButtonText: 'Cancelar',
		preConfirm: () => {
			const name = document.getElementById('swal-filename').value.trim();
			const visible = document.getElementById('swal-visible').value;

			if (!name) {
				Swal.showValidationMessage('El nombre no puede estar vacío');
			}
			return { name, visible };
		}
	});

	if (!formValues) return;

	try {
		const res = await fetch(`${apiBase}/api/files/rename/${fileId}/`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify({
				name: formValues.name,
				visible: formValues.visible === '1'
			})
		});

		const data = await res.json();

		if (res.ok) {
			showNotification('Archivo actualizado correctamente');
			await refreshFiles(); // recarga tabla
		} else {
			showNotification(data.message || 'Error al actualizar archivo', 'error');
		}
	} catch (err) {
		showNotification('Error de red al actualizar archivo', 'error');
	}
}
