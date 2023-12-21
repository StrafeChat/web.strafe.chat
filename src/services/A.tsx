// useEffect(() => {
  //   if(wsInactive) return;
  //   const token = cookie.get("token");
  //   if (!token) return router.push("/login");
  // }, [pathname, router, wsInactive]);

  // useEffect(() => {
  //   const connect = () => {
  //     ws!.current = new WebSocket(process.env.NEXT_PUBLIC_WS!);
  //     ws?.current.addEventListener("open", handleWsOpen);
  //     ws?.current.addEventListener("error", handleWsError);
  //     ws?.current.addEventListener("close", handleWsClose);
  //     document.addEventListener("contextmenu", (event) => {
  //       if ((event.target as HTMLElement).id != "textbox")
  //         event.preventDefault();
  //     });
  //   };

  //   const cleanup = () => {
  //     ws?.current?.removeEventListener("open", handleWsOpen);
  //     ws?.current?.removeEventListener("error", handleWsError);
  //     ws?.current?.removeEventListener("close", handleWsClose);
  //     document.removeEventListener("contextmenu", (event) => {
  //       if ((event.target as HTMLElement).id != "textbox")
  //         event.preventDefault();
  //     });
  //   };

  //   const handleWsOpen = (_event: Event) => {
  //     console.log("OPEN!")
  //     clearCache();
  //     setClientError(false);
  //   };

  //   const handleWsError = (event: Event) => {
  //     console.log(event);
  //   };

  //   const handleWsClose = (_event: CloseEvent) => {
  //     connect();
  //     setClientError(true);
  //   };


  //   if (!ws?.current) { 
  //     connect()
  //   };

  //   return () => cleanup();
  // }, [ws]);

  // useEffect(() => {
  //   const handleWsOpen = (_event: Event) => {
  //     fetch(`${process.env.NEXT_PUBLIC_API}/users/@me/relationships`, {
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: cookie.get("token")!,
  //       },
  //     }).then(async (res) => {
  //       const data = await res.json();

  //       if (!res.ok) return;

  //       setRelationships(data.relationships);
  //     });

  //     fetch(`${process.env.NEXT_PUBLIC_API}/users/@me/rooms`, {
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: cookie.get("token")!,
  //       },
  //     }).then(async (res) => {
  //       const data = await res.json();

  //       if (!res.ok) return;

  //       setPMs([...data.rooms]);
  //     });
  //   };

  //   if (cookie.get("token")) ws?.current?.addEventListener("open", handleWsOpen);

  //   let websocket = ws?.current;

  //   return () => {
  //     if(cookie.get("token")) websocket?.removeEventListener("open", handleWsOpen);
  //   }
  // }, [setPMs, setRelationships, ws]);

  // useEffect(() => {
  //   const handleWsMessage = (evt: MessageEvent) => {
  //     const { op, data, event } = JSON.parse(evt.data);
  //     switch (op) {
  //       case 0:
  //         setInterval(() => {
  //           ws?.current?.send(
  //             JSON.stringify({
  //               op: 1,
  //               data: null,
  //             })
  //           );
  //         }, data.heartbeat_interval);
  //         ws?.current?.send(
  //           JSON.stringify({ op: 2, data: { token: cookie.get("token") } })
  //         );
  //         break;
  //       case 3:
  //         switch (event) {
  //           case "READY":
  //             setUser(data);
  //             setClientError(false);
  //             break;
  //         }
  //         break;
  //       case 4:
  //         switch (data.status) {
  //           case "accepted":
  //             setRelationships((prev) => {
  //               const updatedRelationships = prev.map((relationship) => {
  //                 if (
  //                   relationship.receiver_id === data.receiver_id &&
  //                   relationship.sender_id === data.sender_id
  //                 ) {
  //                   return {
  //                     ...relationship,
  //                     status: "accepted",
  //                   } as Relationship;
  //                 }
  //                 return relationship;
  //               });

  //               return updatedRelationships;
  //             });
  //             break;
  //           case "rejected":
  //           case "deleted":
  //             setRelationships((prev) =>
  //               prev.filter((relationship) => {
  //                 // console.log(relationship.receiver_id, data.receiver_id);
  //                 return (
  //                   relationship.receiver_id != data.receiver_id &&
  //                   relationship.sender_id != data.sender_id
  //                 );
  //               })
  //             );
  //             break;
  //           case "pending":
  //             setRelationships((prev) => [...prev, data]);
  //             break;
  //         }
  //         break;
  //         case 6:
  //           router.push('/login');
  //           break;
  //     }
  //   };

  //   ws?.current?.addEventListener("message", handleWsMessage);

  //   let websocket = ws?.current;

  //   return () => websocket?.removeEventListener("message", handleWsMessage);
  // }, [router, setRelationships, setUser, ws]);

  // useEffect(() => {
  //   const handleMessageCreate = async (data: any) => {
  //     const messages = await getCachedMessages(data.room_id);
  //     if (messages) cacheMessages(data.room_id, [...messages, data]);
  //   };

  //   const handleMessageUpdate = async (data: any) => {
  //     const messages = await getCachedMessages(data.room_id);
  //     if (messages)
  //       cacheMessages(
  //         data.room_id,
  //         messages.map((message) => (message.id == data.id ? data : message))
  //       );
  //   };

  //   const handleMessageDelete = async (data: any) => {
  //     const messages = await getCachedMessages(data.room_id);
  //     if (messages)
  //       cacheMessages(
  //         data.room_id,
  //         messages.filter((message) => message.id != data.message_id)
  //       );
  //   };

  //   const handleWsMessage = (evt: MessageEvent) => {
  //     const { op, data, event } = JSON.parse(evt.data);

  //     switch (op) {
  //       case 3:
  //         switch (event) {
  //           case "MESSAGE_CREATE":
  //             return handleMessageCreate(data);
  //           case "MESSAGE_UPDATE":
  //             return handleMessageUpdate(data);
  //           case "MESSAGE_DELETE":
  //             return handleMessageDelete(data);
  //         }
  //         break;
  //     }
  //   };

  //   ws?.current?.addEventListener("message", handleWsMessage);

  //   let websocket = ws?.current;

  //   return () => websocket?.removeEventListener("message", handleWsMessage);
  // }, [ws]);

  // useEffect(() => {
  //   const handleUserUpdate = async (data: any) => {
  //     setRelationships((prev) => {
  //       return prev.map((relationship) => {
  //         if (relationship.sender_id == data.id) {
  //           return { ...relationship, sender: { ...data } };
  //         } else if (relationship.receiver_id == data.id) {
  //           return { ...relationship, receiver: { ...data } };
  //         } else return relationship;
  //       });
  //     });

  //     setPMs((prev) => {
  //       return prev.map((pm) => {
  //         return {
  //           ...pm,
  //           recipients:
  //             pm.recipients?.map((recipient) => {
  //               if (recipient.id == data.id) {
  //                 return data;
  //               } else {
  //                 return recipient;
  //               }
  //             }) ?? null,
  //         };
  //       });
  //     });
  //   };

  //   const handleWsMessage = (evt: MessageEvent) => {
  //     const { op, data, event } = JSON.parse(evt.data);

  //     switch (op) {
  //       case 3:
  //         switch (event) {
  //           case "USER_UPDATE":
  //             return handleUserUpdate(data);
  //         }
  //         break;
  //     }
  //   };

  //   ws?.current?.addEventListener("message", handleWsMessage);

  //   let websocket = ws?.current;

  //   return () => websocket?.removeEventListener("message", handleWsMessage);
  // }, [setPMs, setRelationships, ws]);

  // useEffect(() => {
  //   const handleWsMessage = (evt: MessageEvent) => {
  //     const { op, data } = JSON.parse(evt.data);

  //     switch (op) {
  //       case 5:
  //         setRelationships((prev) => {
  //           const updatedRelationships = prev.map((relationship) => {
  //             if (
  //               relationship.receiver_id === data.user_id ||
  //               relationship.sender_id === data.user_id
  //             ) {
  //               const updatedUser =
  //                 data.user_id === relationship.receiver_id
  //                   ? {
  //                     ...relationship.receiver,
  //                     presence: { ...data, user_id: undefined },
  //                   }
  //                   : {
  //                     ...relationship.sender,
  //                     presence: { ...data, user_id: undefined },
  //                   };

  //               return {
  //                 ...relationship,
  //                 receiver_id: relationship.receiver_id,
  //                 sender_id: relationship.sender_id,
  //                 receiver:
  //                   data.user_id == relationship.receiver_id
  //                     ? updatedUser
  //                     : relationship.receiver,
  //                 sender:
  //                   data.user_id == relationship.sender_id
  //                     ? updatedUser
  //                     : relationship.sender,
  //               };
  //             }
  //             return relationship;
  //           });

  //           return updatedRelationships;
  //         });

  //         setPMs((prev) => {
  //           const updatedPMs = prev.map((pm) => {
  //             const recipient = pm.recipients?.find(
  //               (recipient) => recipient.id == data.user_id
  //             );

  //             if (recipient) {
  //               const updatedUser = {
  //                 ...recipient,
  //                 presence: { ...data, user_id: undefined },
  //               };

  //               const updatedRecipients = pm.recipients!.map((r) =>
  //                 r.id === data.user_id ? updatedUser : r
  //               );

  //               return {
  //                 ...pm,
  //                 recipients: updatedRecipients,
  //               };
  //             }

  //             return pm;
  //           });

  //           return updatedPMs;
  //         });
  //         break;
  //     }
  //   };

  //   ws?.current?.addEventListener("message", handleWsMessage);
  // }, [setPMs, setRelationships, ws]);