const fs = require('fs');
const file = "c:/Users/patel/OneDrive/Desktop/rrrrr (3) demo - Copy/rrrrr/admin.html";
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('async function handleScanResult(result) {');
const endIdx = content.indexOf('function checkExistingLogin() {');
const endCommentIdx = content.lastIndexOf('// ========== LOGIN & INITIALIZATION ==========', endIdx);

const replacement = `async function handleScanResult(result) {
            const now = Date.now();

            if (now - lastScanTime < SCAN_COOLDOWN) {
                console.log("Scan cooldown active, ignoring scan...");
                return;
            }

            const rsvpId = result.trim();
            console.log("Scanned QR code:", rsvpId, "for day:", currentScanDay);

            lastScanTime = now;
            startCooldownTimer();

            try {
                const guestsRef = collection(firestoreDb, 'guests');
                const q = query(guestsRef, window.firebaseImports.where('rsvp_id', '==', rsvpId));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    showScannerResult('error', 'Invalid QR code! Guest not found in database.');
                    return;
                }

                const guest = querySnapshot.docs[0].data();
                guest.id = querySnapshot.docs[0].id;

                if (!guest.is_attending) {
                    showScannerResult('error', \`\${guest.first_name} \${guest.last_name} is not attending the wedding.\`);
                    return;
                }

                if (!guest.days_attending || !guest.days_attending.includes(currentScanDay)) {
                    showScannerResult('error', \`\${guest.first_name} \${guest.last_name} is not attending this event day.\`);
                    return;
                }

                const attendanceRef = collection(firestoreDb, 'attendance');
                const attendanceQ = query(attendanceRef,
                    window.firebaseImports.where('rsvp_id', '==', rsvpId),
                    window.firebaseImports.where('day', '==', currentScanDay)
                );

                const attendanceSnapshot = await getDocs(attendanceQ);
                let existingAttendance = [];
                attendanceSnapshot.forEach(doc => {
                    existingAttendance.push(doc.data());
                });

                if (existingAttendance.length > 0) {
                    let dayName = '';
                    switch (currentScanDay) {
                        case 'day1': dayName = 'Welcome Dinner'; break;
                        case 'day2': dayName = 'Wedding Day'; break;
                        case 'day3': dayName = 'Farewell Brunch'; break;
                    }

                    showScannerResult('warning',
                        \`<strong>\${guest.first_name} \${guest.last_name}</strong><br>
                         Already checked in for <strong>\${dayName}</strong><br>
                         Previous check-in: \${new Date(existingAttendance[0].check_in_time).toLocaleTimeString()}\`
                    );
                } else {
                    let insertError = null;
                    try {
                        await addDoc(collection(firestoreDb, 'attendance'), {
                            guest_name: \`\${guest.first_name} \${guest.last_name}\`,
                            rsvp_id: rsvpId,
                            day: currentScanDay,
                            staff_member: 'Admin',
                            check_in_time: new Date().toISOString()
                        });
                    } catch (e) {
                        insertError = e;
                    }

                    if (insertError) {
                        console.error('Error saving attendance:', insertError);
                        showScannerResult('error', 'Error saving attendance record!');
                    } else {
                        const updatedCheckedInDays = guest.checked_in_days || [];
                        if (!updatedCheckedInDays.includes(currentScanDay)) {
                            updatedCheckedInDays.push(currentScanDay);

                            try {
                                const guestDocRef = doc(firestoreDb, 'guests', guest.id);
                                await updateDoc(guestDocRef, { checked_in_days: updatedCheckedInDays });
                            } catch (updateError) {
                                console.error('Error updating guest record:', updateError);
                            }
                        }
            
                        let dayName = '';
                        switch (currentScanDay) {
                            case 'day1': dayName = 'Welcome Dinner'; break;
                            case 'day2': dayName = 'Wedding Day'; break;
                            case 'day3': dayName = 'Farewell Brunch'; break;
                        }

                        showScannerResult('success',
                            \`<strong>\${guest.first_name} \${guest.last_name}</strong><br>
                             Successfully checked in for <strong>\${dayName}</strong><br>
                             Time: \${new Date().toLocaleTimeString()}\`
                        );

                        await loadDashboardData();
                    }
                }
            } catch (error) {
                console.error('Error in scan handling:', error);
                showScannerResult('error', 'An unexpected error occurred.');
            }

            setTimeout(() => {
                hideAllScannerResults();
            }, 5000);
        }

        `;

content = content.substring(0, startIdx) + replacement + content.substring(endCommentIdx);
fs.writeFileSync(file, content);
console.log("Rewrite successful.");
