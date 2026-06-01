export const formatDateES = (date) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export const formatDateTimeES = (date) => {
    const d = new Date(date);
    return `${formatDateES(d)} a las ${d.toLocaleTimeString()}`;
};
